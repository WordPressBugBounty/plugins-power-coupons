/* global power_coupons_bogo, wc_cart_params, wc_checkout_params, powerCouponsBogoData */
/**
 * Power Coupons - BOGO JavaScript
 * Handles giveaway product selection and dynamic updates
 *
 * @param {Object} $ jQuery instance.
 * @package
 * @since 1.0.0
 */

( function ( $ ) {
	'use strict';

	const PowerCouponsBOGO = {
		/**
		 * Pending deferred notifications refresh, if one is queued.
		 *
		 * @type {?number}
		 */
		notificationsRefreshTimer: null,

		/**
		 * In-flight notifications request, aborted when a newer one starts.
		 *
		 * @type {?Object}
		 */
		notificationsRequest: null,

		/**
		 * Sync the cart UI after BOGO changed the server-side cart.
		 *
		 * Never fires `wc_update_cart` directly: that is a cart-page-only
		 * event and WooCommerce's `update_wc_div()` hard-reloads the window
		 * when `.woocommerce-cart-form` is absent, which is the case on every
		 * checkout page. The shared helper picks the right mechanism instead.
		 *
		 * @since 1.0.6
		 * @return {Promise} Resolves once the cart UI is in sync.
		 */
		syncCartUi() {
			if ( ! window.PowerCouponsCartRefresh ) {
				return Promise.resolve( false );
			}

			return window.PowerCouponsCartRefresh.refresh( { source: 'bogo' } );
		},

		/**
		 * Re-render the server-rendered BOGO notifications in place.
		 *
		 * The notification markup is built in PHP, so refreshing the cart data
		 * store does not update it. Fetching just this fragment avoids the
		 * page reload that previously kept it in sync.
		 *
		 * @since 1.0.6
		 * @return {Promise} Resolves once the notifications are replaced.
		 */
		refreshNotifications() {
			if ( ! $( '.power-coupons-bogo-notifications' ).length ) {
				return Promise.resolve( false );
			}

			// A stale reply landing after a newer one would delete the fresh box.
			if ( this.notificationsRequest ) {
				this.notificationsRequest.abort();
			}

			const request = $.ajax( {
				url: powerCouponsBogoData.ajaxUrl,
				type: 'GET',
				data: {
					action: 'power_coupons_get_bogo_notifications',
					nonce: powerCouponsBogoData.nonce,
				},
				complete: () => {
					if ( this.notificationsRequest === request ) {
						this.notificationsRequest = null;
					}
				},
			} );

			this.notificationsRequest = request;

			return request
				.then( function ( response ) {
					if ( ! response || ! response.success ) {
						return false;
					}

					// Query now, not at send time: the box may have been replaced meanwhile.
					const $container = $( '.power-coupons-bogo-notifications' );

					if ( ! $container.length ) {
						return false;
					}

					const html = $.trim( response.data.html || '' );

					if ( ! html ) {
						// No offers apply any more: drop the stale markup.
						$container.remove();
						return true;
					}

					const $fresh = $( $.parseHTML( html ) ).filter(
						'.power-coupons-bogo-notifications'
					);

					if ( ! $fresh.length ) {
						return false;
					}

					// Replace every instance (cart and checkout can both render one).
					$container.first().replaceWith( $fresh );
					$( '.power-coupons-bogo-notifications' )
						.not( $fresh )
						.remove();

					return true;
				} )
				.catch( function () {
					// A failed or superseded refresh must not reload the page.
					return false;
				} );
		},

		/**
		 * Initialize
		 */
		init() {
			this.bindEvents();
			this.bindVariableOfferIntercept();
			this.initVariationForms();
		},

		/**
		 * Intercept clicks on BOGO "Apply Offer" buttons during the capture phase
		 * so we can hijack the click for variable get-products before the generic
		 * .power-coupons-apply-coupon-btn handler in frontend.js runs.
		 */
		bindVariableOfferIntercept() {
			document.addEventListener(
				'click',
				( e ) => {
					const btn = e.target.closest(
						'.power-coupons-bogo-offer-button'
					);
					if ( ! btn ) {
						return;
					}

					const wrapper = btn.closest(
						'.power-coupons-bogo-offer-wrapper'
					);
					if ( ! wrapper ) {
						return;
					}

					// The server renders the modal markup as a hidden overlay
					// inside variable offers. Its presence marks this offer as
					// needing a variation pick.
					const dormant = wrapper.querySelector(
						'.power-coupons-bogo-modal-template'
					);
					if ( ! dormant ) {
						return;
					}

					// Hijack the click before the generic apply handler runs.
					e.preventDefault();
					e.stopImmediatePropagation();

					this.openVariationModal( dormant, btn );
				},
				true
			);
		},

		/**
		 * Clone the server-rendered modal markup, mount it on <body>, and wire
		 * events. The dormant copy stays hidden inside the offer wrapper.
		 *
		 * @param {HTMLElement} dormant    The offer's hidden modal overlay.
		 * @param {HTMLElement} triggerBtn The clicked "Apply Offer" button.
		 */
		openVariationModal( dormant, triggerBtn ) {
			this.closeVariationModal();

			const overlay = dormant.cloneNode( true );
			overlay.classList.remove( 'power-coupons-bogo-modal-template' );
			overlay.removeAttribute( 'aria-hidden' );
			document.body.appendChild( overlay );

			const $overlay = $( overlay );
			const $modal = $overlay.find( '.power-coupons-bogo-modal' );
			const $form = $overlay.find( '.power-coupons-bogo-modal-form' );
			const $error = $overlay.find( '.power-coupons-bogo-modal-error' );

			// 'change' = swap an already-applied gift's variation; 'apply' = apply the offer.
			const mode =
				$form.attr( 'data-mode' ) === 'change' ? 'change' : 'apply';

			this.activeModal = {
				$overlay,
				$form,
				$error,
				triggerBtn,
				mode,
			};

			$form.on(
				'change',
				'.power-coupons-bogo-modal-select',
				this.handleModalSelectChange.bind( this )
			);
			// A click handler, not a form `submit`: the wrapper is a <div> so that
			// this markup stays legal when the classic checkout prints it inside
			// WooCommerce's own <form name="checkout"> (see variation-modal.php).
			$form.on(
				'click',
				'.power-coupons-bogo-modal-submit',
				this.submitVariationModal.bind( this )
			);
			$modal.on(
				'click',
				'.power-coupons-bogo-modal-close, .power-coupons-bogo-modal-cancel',
				this.closeVariationModal.bind( this )
			);
			$overlay.on( 'click', ( e ) => {
				if ( e.target === $overlay[ 0 ] ) {
					this.closeVariationModal();
				}
			} );

			// In change mode, pre-select the customer's current variation so they
			// adjust from where they are, then refresh the submit button state.
			if ( 'change' === mode ) {
				this.prefillModalSelections( $form );
				this.handleModalSelectChange();
			}
		},

		/**
		 * Pre-select the modal's variation dropdowns from the currently-added gift.
		 *
		 * @param {jQuery} $form The cloned modal form.
		 */
		prefillModalSelections( $form ) {
			let selections = [];
			try {
				selections = JSON.parse(
					$form.attr( 'data-current-selections' ) || '[]'
				);
			} catch ( err ) {
				selections = [];
			}

			if ( ! Array.isArray( selections ) ) {
				return;
			}

			selections.forEach( ( selection ) => {
				if ( ! selection || ! selection.attributes ) {
					return;
				}

				const $product = $form.find(
					'.power-coupons-bogo-modal-product[data-product-id="' +
						selection.product_id +
						'"]'
				);
				if ( ! $product.length ) {
					return;
				}

				Object.keys( selection.attributes ).forEach( ( slug ) => {
					const value = selection.attributes[ slug ];
					const select = $product
						.find(
							'.power-coupons-bogo-modal-select[data-attr-name="' +
								slug +
								'"]'
						)
						.get( 0 );
					if ( ! select ) {
						return;
					}

					// Match by option value (slug); set selectedIndex explicitly
					// because the block cart can strip empty value="" attributes.
					for ( let i = 0; i < select.options.length; i++ ) {
						if ( select.options[ i ].value === value ) {
							select.selectedIndex = i;
							break;
						}
					}
				} );
			} );
		},

		/**
		 * Close & cleanup the variation modal.
		 */
		closeVariationModal() {
			if ( this.activeModal && this.activeModal.$overlay ) {
				this.activeModal.$overlay.remove();
			}
			this.activeModal = null;
		},

		/**
		 * Toggle submit button when all selects have a value.
		 */
		handleModalSelectChange() {
			if ( ! this.activeModal ) {
				return;
			}
			const $form = this.activeModal.$form;
			let allFilled = true;
			$form.find( '.power-coupons-bogo-modal-select' ).each( function () {
				// The placeholder is always the first option; treat it as
				// "unchosen". value="" can be stripped by the block cart's DOM
				// normalisation, so selectedIndex is the reliable check.
				if ( this.selectedIndex <= 0 ) {
					allFilled = false;
					return false;
				}
			} );
			$form
				.find( '.power-coupons-bogo-modal-submit' )
				.prop( 'disabled', ! allFilled );
		},

		/**
		 * Submit the variation modal — POSTs to the new endpoint that applies
		 * the coupon and adds the chosen variation(s) atomically.
		 *
		 * @param {Event} e
		 */
		submitVariationModal( e ) {
			e.preventDefault();

			if ( ! this.activeModal ) {
				return;
			}

			const { $form, $error, triggerBtn, mode } = this.activeModal;
			const text =
				( window.powerCouponsBogoData &&
					window.powerCouponsBogoData.text ) ||
				{};

			$error.hide().text( '' );

			// Group the chosen attribute values by product, reading the
			// product id from each select's section in the cloned template.
			const selectionMap = {};
			const selections = [];
			let allValid = true;

			$form.find( '.power-coupons-bogo-modal-select' ).each( function () {
				if ( this.selectedIndex <= 0 ) {
					allValid = false;
					return false;
				}

				const $select = $( this );
				const value = $select.val();
				const productId = $select
					.closest( '.power-coupons-bogo-modal-product' )
					.attr( 'data-product-id' );
				const attrName = $select.attr( 'data-attr-name' );

				if ( ! selectionMap[ productId ] ) {
					selectionMap[ productId ] = {
						product_id: parseInt( productId, 10 ),
						attributes: {},
					};
					selections.push( selectionMap[ productId ] );
				}
				selectionMap[ productId ].attributes[ attrName ] = value;
			} );

			if ( ! allValid ) {
				$error
					.text(
						text.selectAllOptions || 'Please choose every option.'
					)
					.show();
				return;
			}

			const couponCode = $form.attr( 'data-coupon-code' );
			const $submit = $form.find( '.power-coupons-bogo-modal-submit' );
			const submitOriginal = $submit.text();
			$submit.prop( 'disabled', true ).text( text.adding || 'Adding...' );

			// 'change' swaps an already-applied gift; 'apply' applies the offer.
			const action =
				'change' === mode
					? 'power_coupons_change_giveaway_variation'
					: 'power_coupons_apply_offer_with_variations';

			$.ajax( {
				url: powerCouponsBogoData.ajaxUrl,
				type: 'POST',
				data: {
					action,
					nonce: powerCouponsBogoData.nonce,
					coupon_code: couponCode,
					variations: selections,
				},
				success: ( response ) => {
					if ( response && response.success ) {
						this.closeVariationModal();
						// The server asks for a refresh after gift options
						// change; do it in place instead of reloading.
						this.syncCartUi().then( () => {
							this.refreshNotifications();
						} );
					} else {
						const message =
							( response &&
								response.data &&
								response.data.message ) ||
							text.error ||
							'Something went wrong.';
						$error.text( message ).show();
						$submit
							.prop( 'disabled', false )
							.text( submitOriginal );
						if ( triggerBtn ) {
							$( triggerBtn )
								.prop( 'disabled', false )
								.removeClass( 'pc-loading' );
						}
					}
				},
				error: () => {
					$error.text( text.error || 'Something went wrong.' ).show();
					$submit.prop( 'disabled', false ).text( submitOriginal );
				},
			} );
		},

		/**
		 * Bind events
		 */
		bindEvents() {
			// Giveaway product selection
			$( document ).on(
				'submit',
				'.power-coupons-bogo-giveaway-selector .variations-form',
				this.handleGiveawaySelection.bind( this )
			);

			// Monitor variation selection changes to enable/disable button
			$( document ).on(
				'change',
				'.power-coupons-bogo-giveaway-selector .variation-select',
				this.handleVariationChange.bind( this )
			);

			// Update BOGO status on cart changes
			$( document.body ).on(
				'updated_cart_totals',
				this.onCartUpdate.bind( this )
			);
			$( document.body ).on(
				'updated_checkout',
				this.onCartUpdate.bind( this )
			);

			// Any Power Coupons cart change (coupon list, drawer, points) can
			// flip an offer's state, and the box is server-rendered, so
			// re-fetch it once the cart UI has settled.
			$( document.body ).on(
				'power_coupons_cart_refreshed',
				( e, detail ) => {
					// BOGO's own flows already refresh after syncCartUi().
					if ( detail && 'bogo' === detail.source ) {
						return;
					}
					this.scheduleNotificationsRefresh();
				}
			);

			// WooCommerce's own coupon form and Remove link on the classic
			// checkout bypass PowerCouponsCartRefresh, so listen for its
			// native coupon events directly — same pattern as
			// ajaxRefreshCouponsHTML() in frontend.js. No need to wait for
			// `update_checkout` to settle first: WC_Cart hooks
			// calculate_totals() to woocommerce_applied_coupon /
			// woocommerce_removed_coupon, so the cart (and BOGO eligibility)
			// is already current by the time these events fire. (The classic
			// cart needs nothing: the box sits inside `.cart_totals`, which
			// WooCommerce re-renders.)
			$( document.body ).on(
				'applied_coupon_in_checkout removed_coupon_in_checkout',
				() => {
					this.scheduleNotificationsRefresh();
				}
			);

			// WooCommerce Blocks: re-render the BOGO notifications in place
			// when a coupon is applied or removed through the block UI.
			this.bindBlockEvents();
		},

		/**
		 * Bind WooCommerce Blocks events for BOGO notification refresh.
		 *
		 * Block cart/checkout handles coupon apply/remove via React — classic
		 * jQuery events don't fire. Use registerCheckoutFilters to detect
		 * coupon changes and re-render the server-rendered notifications in
		 * place.
		 */
		bindBlockEvents() {
			if (
				! window.wc ||
				! window.wc.blocksCheckout ||
				typeof window.wc.blocksCheckout.registerCheckoutFilters !==
					'function'
			) {
				return;
			}

			// Only act on block pages.
			const isBlockPage =
				document.querySelector( '.wc-block-cart' ) !== null ||
				document.querySelector( '.wc-block-checkout' ) !== null;

			if ( ! isBlockPage ) {
				return;
			}

			/*
			 * Blocks treats this as a pure value transform and calls it during
			 * render, so the refresh is queued out of the render pass rather
			 * than issued from inside it. Same contract, and same reasoning, as
			 * scheduleCouponsRefresh() in frontend.js. The single timer also
			 * collapses repeat calls within one pass into one request.
			 */
			window.wc.blocksCheckout.registerCheckoutFilters(
				'powerCouponsBogoRefresh',
				{
					showApplyCouponNotice: ( defaultValue ) => {
						// Coupon applied through the block coupon field: the
						// offer may now be claimed, so re-render the box too.
						this.scheduleNotificationsRefresh();
						return defaultValue;
					},
					showRemoveCouponNotice: ( defaultValue ) => {
						// Coupon removed in block cart/checkout: re-render the
						// BOGO notifications in place rather than reloading.
						this.scheduleNotificationsRefresh();
						return defaultValue;
					},
				}
			);
		},

		/**
		 * Queue a notifications refresh to run after the current task.
		 *
		 * Skipped off cart/checkout: the endpoint only renders the cart box,
		 * so it would overwrite the single product page teaser.
		 *
		 * @since 1.0.7
		 * @return {void}
		 */
		scheduleNotificationsRefresh() {
			if ( ! this.isCartOrCheckoutPage() ) {
				return;
			}

			if ( null !== this.notificationsRefreshTimer ) {
				return;
			}

			this.notificationsRefreshTimer = window.setTimeout( () => {
				this.notificationsRefreshTimer = null;
				this.refreshNotifications();
			}, 0 );
		},

		/**
		 * Whether this page shows the cart/checkout offer box.
		 *
		 * Uses WooCommerce's body classes, not `form.checkout`: CartFlows
		 * Instant Checkout prints a hidden checkout form on product pages.
		 *
		 * @since x.x.x
		 * @return {boolean} True on a classic or block cart/checkout.
		 */
		isCartOrCheckoutPage() {
			const body = document.body.classList;

			// wc_body_class() adds these for is_cart() / is_checkout(), never on product pages.
			if (
				body.contains( 'woocommerce-cart' ) ||
				body.contains( 'woocommerce-checkout' )
			) {
				return true;
			}

			// A cart/checkout block on a page that is not WooCommerce's own cart/checkout page.
			return (
				null !== document.querySelector( '.wc-block-cart' ) ||
				null !== document.querySelector( '.wc-block-checkout' )
			);
		},

		/**
		 * Build a `wc-ajax` endpoint URL without depending on cart.js.
		 *
		 * WooCommerce localises `wc_ajax_url` onto `wc_cart_params` (cart.js)
		 * and `wc_checkout_params` (checkout.js). This script must not force
		 * cart.js onto checkout pages just to read that value: cart.js binds a
		 * document-level `a.woocommerce-remove-coupon` handler whose
		 * `update_wc_div()` hard-reloads any page without
		 * `.woocommerce-cart-form` — which is every checkout page.
		 *
		 * @since 1.0.6
		 * @param {string} endpoint wc-ajax endpoint name.
		 * @return {string} Fully qualified endpoint URL.
		 */
		wcAjaxUrl( endpoint ) {
			const params =
				( 'undefined' !== typeof wc_cart_params && wc_cart_params ) ||
				( 'undefined' !== typeof wc_checkout_params &&
					wc_checkout_params ) ||
				null;

			if ( params && params.wc_ajax_url ) {
				return params.wc_ajax_url
					.toString()
					.replace( '%%endpoint%%', endpoint );
			}

			// Last resort: WooCommerce's documented wc-ajax entry point.
			return '/?wc-ajax=' + encodeURIComponent( endpoint );
		},

		/**
		 * Apply BOGO offer
		 * @param {Event} e
		 */
		applyBogoOffer( e ) {
			e.preventDefault();
			const $button = $( e.currentTarget );
			const couponCode = $button.data( 'coupon-code' );

			if ( ! couponCode ) {
				return;
			}

			// Disable button
			$button
				.prop( 'disabled', true )
				.text( power_coupons_bogo.applying_text || 'Applying...' );

			// Apply coupon via AJAX
			$.ajax( {
				url: PowerCouponsBOGO.wcAjaxUrl( 'apply_coupon' ),
				type: 'POST',
				data: {
					coupon_code: couponCode,
				},
				success: ( response ) => {
					if ( response && response.error ) {
						this.showNotice( response.error, 'error' );
						$button
							.prop( 'disabled', false )
							.text(
								power_coupons_bogo.apply_text || 'Apply Offer'
							);
					} else {
						// Sync in place; `wc_update_cart` would hard-reload
						// on any page without the classic cart form.
						this.syncCartUi().then( () => {
							this.refreshNotifications();
						} );
					}
				},
				error: () => {
					this.showNotice(
						power_coupons_bogo.error_text ||
							'Failed to apply offer',
						'error'
					);
					$button
						.prop( 'disabled', false )
						.text( power_coupons_bogo.apply_text || 'Apply Offer' );
				},
			} );
		},

		/**
		 * Initialize variation forms
		 */
		initVariationForms() {
			$( '.power-coupons-bogo-giveaway-selector .variations-form' ).each(
				function () {
					// Check if all selections are made
					PowerCouponsBOGO.validateForm( $( this ) );
				}
			);
		},

		/**
		 * Handle variation selection change
		 * @param {Event} e
		 */
		handleVariationChange( e ) {
			const $form = $( e.target ).closest( '.variations-form' );
			this.validateForm( $form );
		},

		/**
		 * Validate form and enable/disable button
		 * @param {Object} $form
		 */
		validateForm( $form ) {
			const $button = $form.find( '.power-coupons-add-giveaway-btn' );
			const allSelected = this.areAllAttributesSelected( $form );

			$button.prop( 'disabled', ! allSelected );
		},

		/**
		 * Check if all attributes are selected
		 * @param {Object} $form
		 */
		areAllAttributesSelected( $form ) {
			let allSelected = true;

			$form.find( '.variation-select' ).each( function () {
				if ( ! $( this ).val() ) {
					allSelected = false;
					return false; // Break loop
				}
			} );

			return allSelected;
		},

		/**
		 * Handle giveaway selection
		 * @param {Event} e
		 */
		handleGiveawaySelection( e ) {
			e.preventDefault();

			const $form = $( e.currentTarget );

			// Collect selected attributes
			const attributes = {};
			$form.find( '.variation-select' ).each( function () {
				attributes[ $( this ).attr( 'name' ) ] = $( this ).val();
			} );

			// Validate selection
			if ( ! this.validateSelection( attributes ) ) {
				this.showNotice(
					powerCouponsBogoData.text.selectAllOptions,
					'error'
				);
				return;
			}

			const $button = $form.find( '.power-coupons-add-giveaway-btn' );
			const couponCode = $button.data( 'coupon-code' );
			const productId = $button.data( 'product-id' );

			// Show loading state
			$button
				.prop( 'disabled', true )
				.addClass( 'loading' )
				.text( 'Adding...' );

			// Send AJAX request
			$.ajax( {
				url: powerCouponsBogoData.ajaxUrl,
				type: 'POST',
				data: {
					action: 'power_coupons_add_giveaway_product',
					nonce: powerCouponsBogoData.nonce,
					coupon_code: couponCode,
					product_id: productId,
					attributes,
				},
				success: ( response ) => {
					if ( response.success ) {
						// Trigger cart update
						$( document.body ).trigger( 'wc_fragment_refresh' );
						$( document.body ).trigger( 'updated_wc_div' );

						this.showNotice(
							powerCouponsBogoData.text.giftAdded,
							'success'
						);

						// Hide the product card or show success message
						$form
							.closest( '.giveaway-product-card' )
							.fadeOut( 300 );
					} else {
						this.showNotice(
							response.data.message ||
								powerCouponsBogoData.text.error,
							'error'
						);
						$button
							.prop( 'disabled', false )
							.removeClass( 'loading' )
							.text( 'Add Free Gift' );
					}
				},
				error: () => {
					this.showNotice( powerCouponsBogoData.text.error, 'error' );
					$button
						.prop( 'disabled', false )
						.removeClass( 'loading' )
						.text( 'Add Free Gift' );
				},
			} );
		},

		/**
		 * Validate selection
		 * @param {Object} attributes
		 */
		validateSelection( attributes ) {
			// Check all required attributes are selected
			for ( const key in attributes ) {
				if ( ! attributes[ key ] ) {
					return false;
				}
			}
			return true;
		},

		/**
		 * Handle cart update
		 */
		onCartUpdate() {
			// Cart has been updated, notifications and selector will be re-rendered by PHP
			// Re-initialize forms if they exist
			PowerCouponsBOGO.initVariationForms();
		},

		/**
		 * Show notice
		 * @param {string} message
		 * @param {string} type
		 */
		showNotice( message, type ) {
			// Use WooCommerce notice system
			const noticeClass =
				type === 'error' ? 'woocommerce-error' : 'woocommerce-message';
			const $notice = $( '<div>' )
				.addClass( noticeClass )
				.attr( 'role', 'alert' )
				.text( message );

			// Find or create notices wrapper
			let $wrapper = $( '.woocommerce-notices-wrapper' ).first();
			if ( ! $wrapper.length ) {
				$wrapper = $(
					'<div class="woocommerce-notices-wrapper"></div>'
				);
				$( '.woocommerce' ).prepend( $wrapper );
			}

			$wrapper.html( $notice );

			// Scroll to notice
			$( 'html, body' ).animate(
				{
					scrollTop: $wrapper.offset().top - 100,
				},
				300
			);

			// Auto-hide success messages after 5 seconds
			if ( type === 'success' ) {
				setTimeout( () => {
					$notice.fadeOut( 300, function () {
						$( this ).remove();
					} );
				}, 5000 );
			}
		},
	};

	// Initialize on document ready
	$( document ).ready( () => {
		PowerCouponsBOGO.init();
	} );
} )( jQuery );
