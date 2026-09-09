/**
 * Power Coupons — Points credit redemption frontend JS.
 *
 * Handles credit input widget AJAX interactions on cart, checkout, and My Account.
 *
 * @package
 */

/* global powerCouponsPointsData */
( function ( $ ) {
	'use strict';

	if ( typeof powerCouponsPointsData === 'undefined' ) {
		return;
	}

	const PCPoints = {
		/**
		 * The cart surface this page represents.
		 *
		 * Sent with every request so PHP can apply the merchant's
		 * "show on cart" / "show on checkout" settings. Conditional tags
		 * cannot determine this under `admin-ajax.php` — both come back false.
		 *
		 * @since 1.0.6
		 * @return {string} 'cart', 'checkout', or '' when neither.
		 */
		context() {
			if ( powerCouponsPointsData.is_cart ) {
				return 'cart';
			}

			if ( powerCouponsPointsData.is_checkout ) {
				return 'checkout';
			}

			return '';
		},

		/**
		 * Sync the cart UI after credits were applied or removed.
		 *
		 * The previous implementation fired `wc_update_cart`, which is a
		 * cart-page-only event: WooCommerce's `update_wc_div()` hard-reloads
		 * the window whenever `.woocommerce-cart-form` is missing from the
		 * document, and it is missing on every checkout page. That reload
		 * reset multi-step checkouts (CartFlows, FunnelKit) to step one.
		 *
		 * The shared helper picks the correct mechanism per context instead.
		 *
		 * @since 1.0.6
		 * @return {Promise} Resolves once the cart UI is in sync.
		 */
		syncCartUi() {
			if ( ! window.PowerCouponsCartRefresh ) {
				return Promise.resolve( false );
			}

			return window.PowerCouponsCartRefresh.refresh( {
				source: 'points-credit',
			} );
		},

		/**
		 * Replace the server-rendered redeem widget with fresh markup.
		 *
		 * The widget is rendered in PHP (cart/checkout hooks and `render_block`
		 * for Blocks), so refreshing the cart data store does not re-render it.
		 * The apply/remove AJAX responses return the up-to-date markup, which
		 * is swapped in so the widget flips between its "apply" and "applied"
		 * states without a page reload.
		 *
		 * @since 1.0.6
		 * @param {string} html Fresh widget markup, may be empty.
		 * @return {boolean} True when the widget was replaced.
		 */
		replaceWidget( html ) {
			const $widget = $( '#power-coupons-points-redeem-widget' );

			if ( ! $widget.length ) {
				return false;
			}

			// No markup in the response at all: nothing authoritative to
			// apply, so leave the current widget alone.
			if ( 'string' !== typeof html ) {
				return false;
			}

			const trimmed = $.trim( html );

			// The server renders nothing when the widget no longer applies
			// (for example a fully discounted cart leaves no eligible
			// subtotal). Empty and hide the node rather than removing it: it
			// stays as the anchor to render into if the widget becomes
			// applicable again later in the same page view.
			if ( '' === trimmed ) {
				$widget.empty().attr( 'hidden', 'hidden' );
				return true;
			}

			const $fresh = $( $.parseHTML( trimmed ) ).filter(
				'#power-coupons-points-redeem-widget'
			);

			if ( ! $fresh.length ) {
				return false;
			}

			$widget.replaceWith( $fresh );

			return true;
		},

		/**
		 * Fetch and apply fresh widget markup from the server.
		 *
		 * Used when the cart changed through a route this script does not
		 * control, so the response is the only reliable source of the widget's
		 * current state.
		 *
		 * @since 1.0.6
		 * @return {Promise} Resolves once the widget has been re-rendered.
		 */
		refreshWidget() {
			if ( ! $( '#power-coupons-points-redeem-widget' ).length ) {
				return Promise.resolve( false );
			}

			return $.ajax( {
				url: powerCouponsPointsData.ajax_url,
				type: 'POST',
				data: {
					action: 'power_coupons_get_points_widget',
					security: powerCouponsPointsData.nonce,
					context: PCPoints.context(),
				},
			} )
				.then( function ( response ) {
					if ( ! response || ! response.success ) {
						return false;
					}

					return PCPoints.replaceWidget( response.data.html );
				} )
				.catch( function () {
					// A failed refresh must not break the page.
					return false;
				} );
		},

		/**
		 * Re-render the widget whenever the applied coupons change elsewhere.
		 *
		 * The widget is server-rendered, so nothing updates it when the credit
		 * coupon is removed through WooCommerce's own controls — the Blocks
		 * coupon chip, the classic cart's Remove link, or another extension.
		 * Without this the widget kept showing "discount applied" for a credit
		 * that was no longer on the cart.
		 *
		 * @since 1.0.6
		 * @return {void}
		 */
		watchExternalCartChanges() {
			// Classic cart/checkout: WooCommerce announces coupon changes.
			$( document.body ).on(
				'removed_coupon removed_coupon_in_checkout applied_coupon applied_coupon_in_checkout',
				function () {
					PCPoints.refreshWidget();
				}
			);

			// Cart/Checkout Blocks: watch the cart data store and react only
			// when the set of applied coupons actually changes, since the
			// store notifies on every state update.
			const data = window.wp && window.wp.data;

			if ( ! data || 'function' !== typeof data.subscribe ) {
				return;
			}

			const readCoupons = function () {
				const store = data.select( 'wc/store/cart' );

				if ( ! store || 'function' !== typeof store.getCartData ) {
					return null;
				}

				const cart = store.getCartData();

				if ( ! cart || ! Array.isArray( cart.coupons ) ) {
					return null;
				}

				return cart.coupons
					.map( function ( coupon ) {
						return coupon.code;
					} )
					.sort()
					.join( ',' );
			};

			let known = readCoupons();

			data.subscribe( function () {
				const current = readCoupons();

				if ( null === current || current === known ) {
					return;
				}

				known = current;

				PCPoints.refreshWidget();
			} );
		},

		/**
		 * Initialize event handlers.
		 */
		init() {
			$( document.body ).on(
				'click',
				'.power-coupons-apply-credit-btn',
				this.onApplyCredit
			);
			$( document.body ).on(
				'click',
				'.power-coupons-remove-credit-btn',
				this.onRemoveCredit
			);
			$( document.body ).on(
				'input',
				'.power-coupons-points-credit-input',
				this.onInputChange
			);

			this.watchExternalCartChanges();
		},

		/**
		 * Handle apply credit button click.
		 *
		 * @param {Event} e Click event.
		 */
		onApplyCredit( e ) {
			e.preventDefault();

			const $btn = $( this );

			if ( $btn.hasClass( 'pc-redeeming' ) ) {
				return;
			}

			// In full mode, points come from data attribute; in max_limit mode, from input.
			const dataPoints = $btn.data( 'points' );
			let points;

			if ( dataPoints ) {
				points = parseInt( dataPoints, 10 );
			} else {
				const $input = $( '#power-coupons-points-credit-input' );
				points = parseInt( $input.val(), 10 );

				if ( ! points || points <= 0 ) {
					PCPoints.showNotice(
						powerCouponsPointsData.i18n.enter_points,
						'error'
					);
					$input.trigger( 'focus' );
					return;
				}

				const balance =
					parseInt( powerCouponsPointsData.balance, 10 ) || 0;
				const minPoints =
					parseInt(
						powerCouponsPointsData.min_points_to_redeem,
						10
					) || 0;
				const maxPerOrder =
					parseInt(
						powerCouponsPointsData.max_credits_per_order,
						10
					) || 0;

				if ( minPoints > 0 && points < minPoints ) {
					PCPoints.showNotice(
						powerCouponsPointsData.i18n.below_minimum,
						'error'
					);
					$input.trigger( 'focus' );
					return;
				}

				if ( maxPerOrder > 0 && points > maxPerOrder ) {
					PCPoints.showNotice(
						powerCouponsPointsData.i18n.exceeds_max,
						'error'
					);
					$input.trigger( 'focus' );
					return;
				}

				if ( balance > 0 && points > balance ) {
					PCPoints.showNotice(
						powerCouponsPointsData.i18n.exceeds_balance,
						'error'
					);
					$input.trigger( 'focus' );
					return;
				}
			}

			const originalText = $btn.text();
			$btn.addClass( 'pc-redeeming' ).prop( 'disabled', true );
			$btn.html(
				'<span class="power-coupons-spinner"></span>' +
					powerCouponsPointsData.i18n.applying
			);
			PCPoints.clearNotice();

			$.ajax( {
				url: powerCouponsPointsData.ajax_url,
				type: 'POST',
				data: {
					action: 'power_coupons_apply_points_credit',
					security: powerCouponsPointsData.nonce,
					context: PCPoints.context(),
					points,
				},
				success( response ) {
					if ( response.success ) {
						// Sync the cart FIRST, then re-render the widget and
						// its notice. On the classic cart page WooCommerce
						// replaces the whole totals region (which contains the
						// widget), so anything rendered before the sync would
						// be discarded with the old markup.
						PCPoints.syncCartUi().then( function () {
							PCPoints.replaceWidget( response.data.widget_html );

							PCPoints.showNotice(
								response.data.message ||
									powerCouponsPointsData.i18n.apply_success,
								'success'
							);
						} );
					} else {
						PCPoints.showNotice(
							response.data.message ||
								powerCouponsPointsData.i18n.apply_error,
							'error'
						);
					}
				},
				error() {
					PCPoints.showNotice(
						powerCouponsPointsData.i18n.apply_error,
						'error'
					);
				},
				complete() {
					$btn.removeClass( 'pc-redeeming' )
						.prop( 'disabled', false )
						.text( originalText );
				},
			} );
		},

		/**
		 * Handle remove credit button click.
		 *
		 * @param {Event} e Click event.
		 */
		onRemoveCredit( e ) {
			e.preventDefault();

			const $btn = $( this );

			if ( $btn.hasClass( 'pc-redeeming' ) ) {
				return;
			}

			$btn.addClass( 'pc-redeeming' ).prop( 'disabled', true );

			$.ajax( {
				url: powerCouponsPointsData.ajax_url,
				type: 'POST',
				data: {
					action: 'power_coupons_remove_points_credit',
					security: powerCouponsPointsData.nonce,
					context: PCPoints.context(),
				},
				success( response ) {
					if ( response.success ) {
						// Sync first, then re-render: see onApplyCredit.
						PCPoints.syncCartUi().then( function () {
							PCPoints.replaceWidget( response.data.widget_html );

							PCPoints.showNotice(
								response.data.message ||
									powerCouponsPointsData.i18n.remove_success,
								'success'
							);
						} );
					}
				},
				complete() {
					$btn.removeClass( 'pc-redeeming' ).prop(
						'disabled',
						false
					);
				},
			} );
		},

		/**
		 * Handle input change for live preview.
		 */
		onInputChange() {
			const $input = $( this );
			const $preview = $input
				.closest( '.power-coupons-points-credit-form' )
				.find( '.power-coupons-points-credit-preview' );

			const points = parseInt( $input.val(), 10 );

			if ( ! points || points <= 0 ) {
				$preview.text( '' );
				return;
			}

			const ratio = powerCouponsPointsData.redemption_ratio || 100;
			const discount = points / ratio;
			const symbol = powerCouponsPointsData.currency_symbol || '$';
			const label = powerCouponsPointsData.label_plural || 'Points';

			$preview.text(
				points.toLocaleString() +
					' ' +
					label +
					' = ' +
					symbol +
					discount.toFixed( 2 ) +
					' discount'
			);
		},

		/**
		 * Show a notice message.
		 *
		 * @param {string} message Notice text.
		 * @param {string} type    Notice type: 'success' or 'error'.
		 */
		showNotice( message, type ) {
			const $notice = $( '.power-coupons-points-redeem-notice' );
			if ( $notice.length ) {
				$notice
					.removeClass(
						'power-coupons-points-notice-success power-coupons-points-notice-error'
					)
					.addClass( 'power-coupons-points-notice-' + type )
					.html( '<p>' + message + '</p>' )
					.slideDown( 200 );

				// Scroll notice into view on My Account page.
				if (
					$( '.power-coupons-my-account-points' ).length &&
					$notice.length
				) {
					$( 'html, body' ).animate(
						{ scrollTop: $notice.offset().top - 50 },
						300
					);
				}
			}
		},

		/**
		 * Clear notice messages.
		 */
		clearNotice() {
			$( '.power-coupons-points-redeem-notice' ).slideUp( 150 );
		},
	};

	$( function () {
		PCPoints.init();
	} );
} )( jQuery ); // eslint-disable-line no-redeclare
