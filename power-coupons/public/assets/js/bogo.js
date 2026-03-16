/**
 * Power Coupons - BOGO JavaScript
 * Handles giveaway product selection and dynamic updates
 *
 * @param {Object} $ jQuery instance.
 * @package
 * @since 1.0.0
 */

/* global power_coupons_bogo, wc_cart_params, powerCouponsBogoData */

( function ( $ ) {
	'use strict';

	const PowerCouponsBOGO = {
		/**
		 * Initialize
		 */
		init() {
			this.bindEvents();
			this.initVariationForms();
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

			// WooCommerce Blocks: reload page when coupons change so BOGO notifications refresh.
			this.bindBlockEvents();
		},

		/**
		 * Bind WooCommerce Blocks events for BOGO notification refresh.
		 *
		 * Block cart/checkout handles coupon apply/remove via React — classic
		 * jQuery events don't fire. Use registerCheckoutFilters to detect
		 * coupon changes and reload the page for fresh server-rendered HTML.
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

			window.wc.blocksCheckout.registerCheckoutFilters(
				'powerCouponsBogoRefresh',
				{
					showRemoveCouponNotice( defaultValue ) {
						// Coupon removed in block cart/checkout — reload for fresh BOGO state.
						window.location.reload();
						return defaultValue;
					},
				}
			);
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
				url: wc_cart_params.wc_ajax_url
					.toString()
					.replace( '%%endpoint%%', 'apply_coupon' ),
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
						// Trigger cart update
						$( document.body ).trigger( 'wc_update_cart' );
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
