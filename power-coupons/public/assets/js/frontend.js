/**
 * Power Coupons Public JavaScript
 *
 * Handles coupon apply/remove actions and refreshes on the frontend.
 * Uses jQuery for DOM manipulation and AJAX requests.
 *
 * @param {Object} $ jQuery object
 * @package
 * @since 1.0.0
 */

( function ( $ ) {
	'use strict';

	/**
	 * Power Coupons Main Object
	 *
	 * Manages all coupon-related functionality on the frontend.
	 */
	const PowerCoupons = {
		/**
		 * Active AJAX requests tracker
		 * Prevents duplicate requests from multiple clicks
		 *
		 * @type {Object}
		 */
		activeRequests: {
			apply: null,
			remove: null,
			refresh: null,
		},

		/**
		 * Request timeout, in milliseconds.
		 *
		 * activeRequests gates apply/remove/refresh so a double click cannot
		 * fire twice, and each slot is only released in the request's
		 * `complete` handler. jQuery does not time a request out on its own, so
		 * a connection that stalls rather than fails leaves its slot occupied
		 * and the button inert for as long as the browser holds the socket.
		 *
		 * @type {number}
		 */
		requestTimeout: 30000,

		/**
		 * Initialize the Power Coupons functionality
		 *
		 * Sets up event handlers and WooCommerce integrations.
		 *
		 * @since 1.0.0
		 */
		init() {
			// Validate required data is available
			if ( ! this.validateDependencies() ) {
				console.error( 'Power Coupons: Required data not available' );
				return;
			}

			// Setup WooCommerce event handlers
			this.handleWooCommerceEvents();

			// Bind click events for apply/remove buttons
			this.bindEvents();
		},

		/**
		 * Sync every cart-dependent UI after the server-side cart changed.
		 *
		 * Refreshes in place through the shared cart-refresh helper, which
		 * picks the right mechanism for the current context (Blocks data
		 * store, classic checkout, classic cart).
		 *
		 * A full page reload is opt-in only, via the
		 * `power_coupons_reload_page_after_coupon_is_applied` filter: reloading
		 * discards the in-page state that multi-step checkout plugins such as
		 * CartFlows and FunnelKit hold in the browser, which sends the shopper
		 * back to step one.
		 *
		 * @since 1.0.6
		 * @return {Promise} Resolves once the cart UI is in sync.
		 */
		syncCartUi() {
			if ( powerCouponsData.reloadPageAfterCouponApplied ) {
				window.location.reload();

				// Never resolves: the document is being torn down, so no
				// follow-up UI work should run.
				return new Promise( function () {} );
			}

			if ( ! window.PowerCouponsCartRefresh ) {
				return Promise.resolve( false );
			}

			return window.PowerCouponsCartRefresh.refresh( {
				source: 'coupon-list',
			} );
		},

		/**
		 * Validate that all required dependencies are available
		 *
		 * Checks for powerCouponsData object and required AJAX URLs.
		 *
		 * @since 1.0.0
		 * @return {boolean} True if all dependencies are available
		 */
		validateDependencies() {
			if ( typeof powerCouponsData === 'undefined' ) {
				return false;
			}

			if ( ! powerCouponsData.ajaxUrl || ! powerCouponsData.nonce ) {
				return false;
			}

			return true;
		},

		/**
		 * Escape a value for use inside an attribute selector.
		 *
		 * Extracted for readability; the fallback below is belt-and-braces and
		 * is not expected to run. The audit flagged the bare `CSS.escape` call
		 * as unpolyfilled, but this file already uses optional chaining and
		 * `??` and is shipped untranspiled, so any engine old enough to lack
		 * `CSS.escape` (pre-2016) fails to parse the file long before reaching
		 * this line — and `.browserslistrc` targets the last four versions of
		 * each major browser anyway. Keeping the guard costs nothing and makes
		 * the selector construction explicit.
		 *
		 * @since 1.0.7
		 * @param {string} value Raw value, typically a coupon code.
		 * @return {string} Value safe to interpolate into a selector.
		 */
		escapeForSelector( value ) {
			const raw = String( value ?? '' );

			if (
				typeof window.CSS !== 'undefined' &&
				typeof window.CSS.escape === 'function'
			) {
				return window.CSS.escape( raw );
			}

			return raw.replace( /["'\\\]\[\s]/g, '\\$&' );
		},

		/**
		 * Pending deferred refresh timer, if one is queued.
		 *
		 * @type {?number}
		 */
		refreshTimer: null,

		/**
		 * Queue a coupon-list refresh to run after the current task.
		 *
		 * WooCommerce Blocks calls its checkout filters during render and
		 * expects them to be pure value transforms. Calling
		 * ajaxRefreshCouponsHTML() straight from one issued an XHR from inside
		 * someone else's render pass; deferring by a tick moves the side effect
		 * out of it, and the single timer collapses any repeat calls within one
		 * pass into a single request.
		 *
		 * Measured on a real block cart, this is request-count neutral for a
		 * quantity change (8 requests over 4 changes, before and after) — the
		 * old code's abort-and-retry already collapsed most of the repeats. The
		 * point of this is the render-pass contract, not throughput.
		 *
		 * @since 1.0.7
		 * @return {void}
		 */
		scheduleCouponsRefresh() {
			if ( null !== PowerCoupons.refreshTimer ) {
				return;
			}

			PowerCoupons.refreshTimer = window.setTimeout( function () {
				PowerCoupons.refreshTimer = null;
				PowerCoupons.ajaxRefreshCouponsHTML();
			}, 0 );
		},

		/**
		 * Normalise a coupon code so both sources compare equal.
		 *
		 * The order review row carries the code as a `coupon-<code>` class run
		 * through WordPress's `sanitize_title()`, while the cards carry it raw
		 * in `data-coupon`. A code containing a space or symbol would otherwise
		 * never match itself and the two views would look permanently out of
		 * sync.
		 *
		 * @since 1.0.7
		 * @param {string} code Raw or sanitised coupon code.
		 * @return {string} Comparable form.
		 */
		normalizeCouponCode( code ) {
			return String( code ?? '' )
				.toLowerCase()
				.replace( /[^a-z0-9]+/g, '-' )
				.replace( /^-+|-+$/g, '' );
		},

		/**
		 * Coupons the cart says are applied, read from the order review.
		 *
		 * Read from the `tr.cart-discount` rows rather than any one plugin's
		 * remove control: WooCommerce renders
		 * `a.woocommerce-remove-coupon` and CartFlows renders
		 * `a.wcf-remove-coupon` inside the same row, but both put the code in a
		 * `coupon-<code>` class on the row itself.
		 *
		 * @since 1.0.7
		 * @return {string} Sorted, comma-separated coupon codes.
		 */
		appliedCouponSignature() {
			const codes = [];

			document
				.querySelectorAll( '.cart-discount' )
				.forEach( function ( row ) {
					const fromControl = row.querySelector( '[data-coupon]' );

					if ( fromControl && fromControl.dataset.coupon ) {
						codes.push(
							PowerCoupons.normalizeCouponCode(
								fromControl.dataset.coupon
							)
						);

						return;
					}

					row.classList.forEach( function ( className ) {
						if ( 0 === className.indexOf( 'coupon-' ) ) {
							codes.push(
								PowerCoupons.normalizeCouponCode(
									className.slice( 'coupon-'.length )
								)
							);
						}
					} );
				} );

			return PowerCoupons.toSignature( codes );
		},

		/**
		 * Coupons the rendered cards currently show as applied.
		 *
		 * @since 1.0.7
		 * @return {string} Sorted, comma-separated coupon codes.
		 */
		renderedCouponSignature() {
			const codes = [];

			document
				.querySelectorAll(
					'.power-coupons-apply-coupon-btn[data-coupon-status="applied"]'
				)
				.forEach( function ( button ) {
					if ( button.dataset.coupon ) {
						codes.push(
							PowerCoupons.normalizeCouponCode(
								button.dataset.coupon
							)
						);
					}
				} );

			return PowerCoupons.toSignature( codes );
		},

		/**
		 * Reduce a list of codes to a comparable signature.
		 *
		 * @since 1.0.7
		 * @param {Array<string>} codes Coupon codes.
		 * @return {string} Sorted, de-duplicated, comma-separated codes.
		 */
		toSignature( codes ) {
			return Array.from( new Set( codes.filter( Boolean ) ) )
				.sort()
				.join( ',' );
		},

		/**
		 * Re-render the coupon list when it disagrees with the cart.
		 *
		 * Compares two live views — what the order review says is applied
		 * against what the cards show — rather than diffing against a
		 * remembered value. A remembered baseline goes stale whenever the cart
		 * changes through a route that does not refresh both, and then
		 * suppresses the very refresh it exists to trigger. Comparing the two
		 * current views instead makes this self-correcting: it fires whenever
		 * they drift apart, however they got there, and stays quiet when they
		 * agree.
		 *
		 * That quiet matters — `updated_checkout` fires on address edits,
		 * shipping switches and quantity changes, none of which touch coupons.
		 *
		 * @since 1.0.7
		 * @return {void}
		 */
		refreshIfCouponsChanged() {
			if (
				PowerCoupons.appliedCouponSignature() ===
				PowerCoupons.renderedCouponSignature()
			) {
				return;
			}

			// No coupon code: take the whole-list branch, because this path
			// only knows the views drifted, not which coupon moved.
			PowerCoupons.ajaxRefreshCouponsHTML();
		},

		/**
		 * AJAX function to refresh coupons HTML
		 *
		 * Fetches updated coupon list from server and replaces existing list.
		 * Uses modern DOM APIs for better performance.
		 * @param {Event}  event      Click event.
		 * @param {string} couponCode Removed coupon code.
		 */
		ajaxRefreshCouponsHTML( event, couponCode ) {
			// Cancel any pending refresh request
			if ( PowerCoupons.activeRequests.refresh ) {
				PowerCoupons.activeRequests.refresh.abort();
			}

			const dataContext = $( '.power-coupons-list' ).attr(
				'data-context'
			);

			// Make AJAX request to get fresh coupon HTML
			PowerCoupons.activeRequests.refresh = $.ajax( {
				type: 'GET',
				url: powerCouponsData.ajaxUrl.getCouponsHtml,
				timeout: PowerCoupons.requestTimeout,
				data: {
					nonce: powerCouponsData.nonce,
					context: dataContext || 'ajax',
					couponCode,
				},
				success( response ) {
					if ( parseInt( response.coupon_id, 10 ) > 0 ) {
						const selector = `.power-coupons-apply-coupon-btn[data-coupon="${ PowerCoupons.escapeForSelector(
							response.coupon_code
						) }"]`;

						const couponCards =
							document.querySelectorAll( selector );

						const template = document.createElement( 'template' );
						template.innerHTML = response.html.trim();

						// The response is a whole `.power-coupons-list` wrapper
						// containing just this coupon, but each coupon IS the
						// button (see views/coupon-list.php), and every button
						// shares one `.power-coupons-section` parent. Replacing
						// the button's grandparent therefore swapped the entire
						// list for a single card and silently dropped every
						// other coupon — visible in the drawer, which renders
						// them all. Swap the button itself instead.
						const freshCard =
							template.content.querySelector( selector );

						if ( ! freshCard ) {
							return;
						}

						couponCards.forEach( function ( couponCard ) {
							couponCard.replaceWith(
								freshCard.cloneNode( true )
							);
						} );

						return;
					}

					const drawerList = document.querySelector(
						'.power-coupons-drawer-coupons-list'
					);

					if ( drawerList ) {
						drawerList.innerHTML = response.html;

						// Trigger custom event for extensions.
						jQuery( document ).trigger( 'powerCoupons:refreshed' );
					}
				},
				error( jqXHR, textStatus ) {
					if ( textStatus !== 'abort' ) {
						// Leave the stale list in place rather than reloading:
						// the cart itself is already correct, and a reload
						// would reset multi-step checkout progress.
						console.error(
							'Power Coupons: Failed to refresh coupons list'
						);
					}
				},
				complete() {
					// Clear request reference
					PowerCoupons.activeRequests.refresh = null;
				},
			} );
		},

		/**
		 * Handle WooCommerce-specific events
		 *
		 * Refreshes coupon list when coupons are applied/removed via:
		 * - Classic WooCommerce cart/checkout forms
		 * - WooCommerce Blocks (cart/checkout blocks)
		 *
		 * @since 1.0.0
		 */
		handleWooCommerceEvents() {
			// ============================================
			// Classic WooCommerce Cart/Checkout Events
			// ============================================

			// Coupon applied in classic cart
			$( 'body' ).on(
				'applied_coupon',
				PowerCoupons.ajaxRefreshCouponsHTML
			);

			// Coupon removed in classic cart
			$( 'body' ).on(
				'removed_coupon',
				PowerCoupons.ajaxRefreshCouponsHTML
			);

			// Coupon applied in classic checkout
			$( 'body' ).on(
				'applied_coupon_in_checkout',
				PowerCoupons.ajaxRefreshCouponsHTML
			);

			// Coupon removed in classic checkout
			$( 'body' ).on(
				'removed_coupon_in_checkout',
				PowerCoupons.ajaxRefreshCouponsHTML
			);

			// Coupon removed in classic checkout
			$( 'body' ).on(
				'updated_cart_totals',
				PowerCoupons.ajaxRefreshCouponsHTML
			);

			// Checkouts that never fire WooCommerce's coupon events.
			//
			// CartFlows' step checkout applies and removes coupons through its
			// own handlers and its own `a.wcf-remove-coupon` control, and on
			// success triggers only `update_checkout`
			// (cartflows/assets/js/checkout-template.js). None of the five
			// events above fire, so removing a coupon from the step's order
			// summary left the drawer still showing it as applied.
			//
			// Watching `updated_checkout` covers any such integration without
			// needing to know about it, and comparing the applied-coupon set
			// keeps the ordinary checkout refreshes free.
			$( 'body' ).on( 'updated_checkout', function () {
				PowerCoupons.refreshIfCouponsChanged();
			} );

			// ============================================
			// WooCommerce Blocks Integration
			// ============================================

			// Check if WooCommerce Blocks API is available
			if (
				window &&
				window.wc &&
				window.wc.blocksCheckout &&
				typeof window.wc.blocksCheckout.registerCheckoutFilters ===
					'function'
			) {
				/*
				 * These are the only signal Blocks gives us that the cart
				 * changed, but Blocks treats them as pure value transforms and
				 * calls them during render — `totalValue` once per totals row.
				 *
				 * So each one records that a refresh is wanted and returns the
				 * value untouched. The refresh itself is queued out of the
				 * render pass by scheduleCouponsRefresh(), which also collapses
				 * a whole render's worth of calls into a single request.
				 */
				window.wc.blocksCheckout.registerCheckoutFilters(
					'powerCouponsRefreshCoupons',
					{
						/**
						 * Cart totals changed.
						 *
						 * @param {string} defaultValue - The formatted total.
						 * @return {string} The default value (pass through)
						 */
						totalValue( defaultValue ) {
							PowerCoupons.scheduleCouponsRefresh();
							return defaultValue;
						},

						/**
						 * Filter for apply coupon notice
						 * Refreshes coupon list when coupon is applied in blocks
						 *
						 * @param {boolean} defaultValue - Whether to show notice
						 * @return {boolean} The default value (pass through)
						 */
						showApplyCouponNotice( defaultValue ) {
							PowerCoupons.scheduleCouponsRefresh();
							return defaultValue;
						},

						/**
						 * Filter for remove coupon notice
						 * Refreshes coupon list when coupon is removed in blocks
						 *
						 * @param {boolean} defaultValue - Whether to show notice
						 * @return {boolean} The default value (pass through)
						 */
						showRemoveCouponNotice( defaultValue ) {
							PowerCoupons.scheduleCouponsRefresh();
							return defaultValue;
						},
					}
				);
			}
		},

		/**
		 * Bind click events to coupon action buttons
		 *
		 * Uses event delegation for better performance and to handle
		 * dynamically added elements (after AJAX refresh).
		 *
		 * @since 1.0.0
		 */
		bindEvents() {
			const self = this;

			// Apply coupon button click
			// Simpler: clicking a coupon card applies it (unless user clicks a button in it)
			$( document ).on(
				'click',
				'.power-coupons-list .power-coupon-card',
				function ( e ) {
					if (
						! $( e.target ).closest(
							'.apply-coupon, .remove-coupon'
						).length
					) {
						$( this )
							.find( '.apply-coupon' )
							.first()
							.trigger( 'click' );
					}
				}
			);

			$( document ).on(
				'click',
				'.power-coupons-apply-coupon-btn',
				function ( e ) {
					self.applyCoupon.call( this, e, self );
				}
			);

			// Remove coupon button click
			$( document ).on( 'click', '.remove-coupon', function ( e ) {
				self.removeCoupon.call( this, e, self );
			} );
		},

		/**
		 * Apply coupon to cart
		 *
		 * Sends AJAX request to apply coupon and updates UI accordingly.
		 *
		 * @since 1.0.0
		 * @param {Event}  e    - Click event object
		 * @param {Object} self - Reference to PowerCoupons object
		 */
		applyCoupon( e, self ) {
			e.preventDefault();

			const $button = $( this );
			const couponCode = $button.data( 'coupon' );

			// Validate coupon code
			if ( ! couponCode ) {
				console.error( 'Power Coupons: No coupon code found' );
				return;
			}

			// Prevent duplicate requests
			if ( self.activeRequests.apply ) {
				return;
			}

			const originalText = $button.html();

			// Update button state - show loading
			$button
				.prop( 'disabled', true )
				.attr( 'aria-disabled', 'true' )
				.attr( 'aria-busy', 'true' )
				.addClass( 'pc-loading' )
				.find( '.power-coupons-coupon-status' )
				.text( powerCouponsData.text?.applyingText || 'Applying...' );

			// Send AJAX request
			self.activeRequests.apply = $.ajax( {
				type: 'POST',
				url: powerCouponsData.ajaxUrl.applyCoupon,
				timeout: PowerCoupons.requestTimeout,
				data: {
					coupon_code: couponCode,
					nonce: powerCouponsData.nonce,
					billing_email: $( 'input[name="billing_email"]' ).val(),
				},
				success( response ) {
					if ( response.success ) {
						// Sync cart totals in place, then re-render the
						// coupon cards against the fresh cart.
						self.syncCartUi().then( function () {
							PowerCoupons.ajaxRefreshCouponsHTML();
						} );
					} else {
						// Failed - show error message
						const errorMessage =
							response.data?.message ||
							powerCouponsData.text?.applyErrorText ||
							'Failed to apply coupon.';

						self.showNotice( errorMessage, 'error' );

						// Refresh coupon list after a short delay
						setTimeout( function () {
							PowerCoupons.ajaxRefreshCouponsHTML();
						}, 500 );
					}
				},
				error( jqXHR, textStatus ) {
					// Network error or server error
					if ( textStatus !== 'abort' ) {
						const errorMessage =
							powerCouponsData.text?.applyErrorText ||
							'Failed to apply coupon. Please try again.';

						self.showNotice( errorMessage, 'error' );

						// Restore button state
						$button
							.prop( 'disabled', false )
							.attr( 'aria-disabled', 'false' )
							.attr( 'aria-busy', 'false' )
							.removeClass( 'pc-loading' )
							.text( originalText );
					}
				},
				complete() {
					// Clear request reference
					self.activeRequests.apply = null;
				},
			} );
		},

		/**
		 * Remove coupon from cart
		 *
		 * Sends AJAX request to remove coupon and updates UI accordingly.
		 *
		 * @since 1.0.0
		 * @param {Event}  e    - Click event object
		 * @param {Object} self - Reference to PowerCoupons object
		 */
		removeCoupon( e, self ) {
			e.preventDefault();

			const $button = $( this );
			const couponCode = $button.data( 'coupon' );

			// Validate coupon code
			if ( ! couponCode ) {
				console.error( 'Power Coupons: No coupon code found' );
				return;
			}

			// Prevent duplicate requests
			if ( self.activeRequests.remove ) {
				return;
			}

			const originalText = $button.text();

			// Update button state - show loading
			$button
				.prop( 'disabled', true )
				.attr( 'aria-disabled', 'true' )
				.attr( 'aria-busy', 'true' )
				.addClass( 'pc-loading' )
				.text( powerCouponsData.text?.removingText || 'Removing...' );

			// Send AJAX request
			self.activeRequests.remove = $.ajax( {
				type: 'POST',
				url: powerCouponsData.ajaxUrl.removeCoupon,
				timeout: PowerCoupons.requestTimeout,
				data: {
					coupon_code: couponCode,
					nonce: powerCouponsData.nonce,
				},
				success( response ) {
					if ( response.success ) {
						// Sync cart totals in place, then re-render the
						// coupon cards against the fresh cart.
						self.syncCartUi().then( function () {
							PowerCoupons.ajaxRefreshCouponsHTML();
						} );
					} else {
						// Failed - show error message
						const errorMessage =
							response.data?.message ||
							powerCouponsData.text?.removeErrorText ||
							'Failed to remove coupon.';

						self.showNotice( errorMessage, 'error' );

						// Restore button state
						$button
							.prop( 'disabled', false )
							.attr( 'aria-disabled', 'false' )
							.attr( 'aria-busy', 'false' )
							.removeClass( 'pc-loading' )
							.text( originalText );
					}
				},
				error( jqXHR, textStatus ) {
					// Network error or server error
					if ( textStatus !== 'abort' ) {
						const errorMessage =
							powerCouponsData.text?.removeErrorText ||
							'Failed to remove coupon. Please try again.';

						self.showNotice( errorMessage, 'error' );

						// Restore button state
						$button
							.prop( 'disabled', false )
							.attr( 'aria-disabled', 'false' )
							.attr( 'aria-busy', 'false' )
							.removeClass( 'pc-loading' )
							.text( originalText );
					}
				},
				complete() {
					// Clear request reference
					self.activeRequests.remove = null;
				},
			} );
		},

		/**
		 * Show notice message to user
		 *
		 * Attempts to use WooCommerce notice system if available,
		 * falls back to browser alert as last resort.
		 *
		 * @since 1.0.0
		 * @param {string} message - Message to display
		 * @param {string} type    - Notice type: 'success', 'error', 'notice'
		 */
		showNotice( message, type ) {
			type = type || 'notice';

			// Use role="status" (polite) for success, role="alert" (assertive) for errors.
			const noticeRole = type === 'error' ? 'alert' : 'status';
			const ariaLive = type === 'error' ? 'assertive' : 'polite';

			// Try to use WooCommerce notices if available
			const noticeContainer = $( '.woocommerce-notices-wrapper' ).first();

			if ( noticeContainer.length ) {
				// Create WooCommerce-style notice
				const noticeClass =
					type === 'error'
						? 'woocommerce-error'
						: 'woocommerce-message';
				const notice = $( '<div>' )
					.addClass( noticeClass )
					.attr( 'role', noticeRole )
					.attr( 'aria-live', ariaLive )
					.attr( 'aria-atomic', 'true' )
					.text( message );

				// Clear existing notices and add new one
				noticeContainer.empty().append( notice );

				// Scroll to notice
				$( 'html, body' ).animate(
					{
						scrollTop: noticeContainer.offset().top - 100,
					},
					500
				);

				// Auto-dismiss success notices after 10 seconds (increased from 5 for accessibility)
				if ( type === 'success' ) {
					setTimeout( function () {
						notice.fadeOut( function () {
							$( this ).remove();
						} );
					}, 10000 );
				}
			} else {
				// Fallback: create a temporary inline notice instead of disruptive alert().
				const fallbackNotice = $( '<div>' )
					.addClass( 'power-coupons-inline-notice' )
					.attr( 'role', noticeRole )
					.attr( 'aria-atomic', 'true' )
					.text( message )
					.css( {
						position: 'fixed',
						top: '20px',
						right: '20px',
						zIndex: 999999,
						padding: '12px 20px',
						borderRadius: '4px',
						maxWidth: '400px',
						background: type === 'error' ? '#fee2e2' : '#f0fdf4',
						color: type === 'error' ? '#991b1b' : '#166534',
						border:
							'1px solid ' +
							( type === 'error' ? '#fecaca' : '#86efac' ),
						boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
						fontSize: '14px',
						lineHeight: '1.5',
					} );

				$( 'body' ).append( fallbackNotice );

				setTimeout( function () {
					fallbackNotice.fadeOut( function () {
						$( this ).remove();
					} );
				}, 5000 );
			}
		},
	};

	/**
	 * Initialize on DOM ready
	 *
	 * Waits for jQuery and DOM to be ready before initializing.
	 */
	$( document ).ready( function () {
		PowerCoupons.init();
	} );
} )( jQuery );
