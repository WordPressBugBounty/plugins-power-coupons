/**
 * Power Coupons - Shared cart refresh helper.
 *
 * Single source of truth for "the server-side cart changed, now sync the UI".
 *
 * Every Power Coupons frontend script (coupon list, checkout drawer, BOGO,
 * points credit) must route through this helper instead of reloading the page.
 * A reload destroys in-page state that multi-step checkout plugins such as
 * CartFlows and FunnelKit keep in the browser, forcing the shopper back to
 * step 1.
 *
 * Each rendering context has its own native refresh mechanism:
 *
 * - Cart/Checkout Blocks: invalidate the `wc/store/cart` data store so the
 *   Blocks UI re-fetches the cart from the Store API and re-renders totals,
 *   coupon rows and notices.
 * - Classic checkout: `update_checkout`, which WooCommerce's checkout.js turns
 *   into an `update_order_review` request and applies as DOM fragments.
 * - Classic cart: `wc_update_cart`, which WooCommerce's cart.js turns into an
 *   `update_cart` request and applies via `update_wc_div()`.
 *
 * `wc_update_cart` must NEVER be fired off the classic cart page. WooCommerce's
 * `update_wc_div()` hard-reloads the window when `.woocommerce-cart-form` is
 * absent from the document, which is the case on every checkout page.
 *
 * @param {Object} $ jQuery object
 * @package
 * @since 1.0.6
 */
( function ( $ ) {
	'use strict';

	/**
	 * Milliseconds to wait for the Blocks cart store to finish re-resolving
	 * before giving up and letting callers continue.
	 *
	 * @type {number}
	 */
	const BLOCKS_RESOLVE_TIMEOUT = 8000;

	/**
	 * Milliseconds to wait for WooCommerce's classic cart/checkout request to
	 * finish re-rendering before giving up and letting callers continue.
	 *
	 * @type {number}
	 */
	const CLASSIC_RESOLVE_TIMEOUT = 8000;

	const PowerCouponsCartRefresh = {
		/**
		 * Promise for an in-flight refresh, so concurrent callers coalesce
		 * into a single round trip instead of stacking requests.
		 *
		 * @type {Promise|null}
		 */
		pending: null,

		/**
		 * Whether the page is rendered with the WooCommerce Cart block.
		 *
		 * @return {boolean} True when the Cart block is present.
		 */
		isBlockCart() {
			return null !== document.querySelector( '.wc-block-cart' );
		},

		/**
		 * Whether the page is rendered with the WooCommerce Checkout block.
		 *
		 * @return {boolean} True when the Checkout block is present.
		 */
		isBlockCheckout() {
			return null !== document.querySelector( '.wc-block-checkout' );
		},

		/**
		 * Whether the page renders the classic (shortcode) cart form.
		 *
		 * This is the only context in which `wc_update_cart` is safe to fire.
		 *
		 * @return {boolean} True when the classic cart form is present.
		 */
		isClassicCart() {
			return null !== document.querySelector( '.woocommerce-cart-form' );
		},

		/**
		 * Whether the page renders the classic (shortcode) checkout form.
		 *
		 * @return {boolean} True when the classic checkout form is present.
		 */
		isClassicCheckout() {
			return null !== document.querySelector( 'form.checkout' );
		},

		/**
		 * Resolve the `wc/store/cart` data store when Blocks are in play.
		 *
		 * @return {Object|null} Object with `select` and `dispatch`, or null.
		 */
		getBlocksCartStore() {
			const data = window.wp && window.wp.data;

			if ( ! data || 'function' !== typeof data.dispatch ) {
				return null;
			}

			const dispatch = data.dispatch( 'wc/store/cart' );
			const select = data.select( 'wc/store/cart' );

			if (
				! dispatch ||
				! select ||
				'function' !== typeof dispatch.invalidateResolutionForStore
			) {
				return null;
			}

			return { dispatch, select };
		},

		/**
		 * Refresh the Cart/Checkout Blocks UI from the Store API.
		 *
		 * @return {Promise} Resolves once the cart store has re-resolved.
		 */
		refreshBlocks() {
			const store = this.getBlocksCartStore();

			if ( ! store ) {
				return Promise.resolve( false );
			}

			store.dispatch.invalidateResolutionForStore();

			// Wait for the re-fetch to settle so callers that re-render their
			// own markup afterwards read fresh cart data.
			return new Promise( function ( resolve ) {
				const started = Date.now();
				let unsubscribe = null;
				let settled = false;

				const finish = function () {
					if ( settled ) {
						return;
					}

					settled = true;

					if ( unsubscribe ) {
						unsubscribe();
					}

					resolve( true );
				};

				const check = function () {
					if ( Date.now() - started > BLOCKS_RESOLVE_TIMEOUT ) {
						finish();
						return;
					}

					// `hasFinishedResolution` flips back to true once the
					// invalidated `getCartData` resolver has re-run.
					if (
						'function' ===
							typeof store.select.hasFinishedResolution &&
						store.select.hasFinishedResolution( 'getCartData' )
					) {
						finish();
					}
				};

				const data = window.wp && window.wp.data;

				if ( data && 'function' === typeof data.subscribe ) {
					unsubscribe = data.subscribe( check );
				}

				// Safety net in case the store never reports completion.
				setTimeout( finish, BLOCKS_RESOLVE_TIMEOUT );
			} );
		},

		/**
		 * Refresh the classic cart and/or checkout DOM.
		 *
		 * Resolves only once WooCommerce has finished replacing its markup.
		 * Callers re-render their own server-rendered fragments afterwards, and
		 * WooCommerce's `update_wc_div()` replaces the whole cart totals region
		 * — so resolving early would let those fragments be overwritten.
		 *
		 * @return {Promise} Resolves once WooCommerce has re-rendered.
		 */
		refreshClassic() {
			const $body = $( document.body );
			const isCart = this.isClassicCart();
			const isCheckout = this.isClassicCheckout();

			// The event WooCommerce fires once it has swapped its markup in.
			const doneEvent = isCart ? 'updated_wc_div' : 'updated_checkout';

			const settled = new Promise( function ( resolve ) {
				if ( ! isCart && ! isCheckout ) {
					resolve( false );
					return;
				}

				let timer = null;

				const onDone = function () {
					clearTimeout( timer );
					$body.off( doneEvent, onDone );
					resolve( true );
				};

				$body.on( doneEvent, onDone );

				// Safety net: never leave the caller's chain hanging if
				// WooCommerce does not report completion.
				timer = setTimeout( function () {
					$body.off( doneEvent, onDone );
					resolve( false );
				}, CLASSIC_RESOLVE_TIMEOUT );
			} );

			if ( isCart ) {
				// Safe here and only here: cart.js needs `.woocommerce-cart-form`
				// in the document or it reloads the window.
				$body.trigger( 'wc_update_cart' );
			}

			if ( isCheckout ) {
				$body.trigger( 'update_checkout' );
			}

			// Keep mini-cart / cart-count fragments in sync on every page,
			// including product and archive pages that show a mini cart.
			$body.trigger( 'wc_fragment_refresh' );

			return settled;
		},

		/**
		 * Sync every cart-dependent UI on the page after a server-side change.
		 *
		 * Safe to call from any page. Never reloads the window.
		 *
		 * @param {Object} [detail] Optional context passed to subscribers.
		 * @return {Promise} Resolves once the refresh has settled.
		 */
		refresh( detail ) {
			const self = this;

			// Coalesce overlapping calls into the in-flight refresh.
			if ( self.pending ) {
				return self.pending;
			}

			const isBlocks = self.isBlockCart() || self.isBlockCheckout();

			const run = isBlocks ? self.refreshBlocks() : self.refreshClassic();

			self.pending = run
				.catch( function () {
					// A failed refresh must not break the caller's UI flow.
					return false;
				} )
				.then( function ( result ) {
					self.pending = null;

					// Let WooCommerce integrations and third parties know the
					// coupon set changed, without triggering a cart reload.
					$( document.body ).trigger(
						'power_coupons_cart_refreshed',
						[ detail || {} ]
					);

					return result;
				} );

			return self.pending;
		},
	};

	window.PowerCouponsCartRefresh = PowerCouponsCartRefresh;
} )( jQuery );
