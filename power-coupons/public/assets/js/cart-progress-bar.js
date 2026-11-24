/**
 * Power Coupons - Cart Progress Bar JavaScript
 * Handles real-time progress bar updates on cart/checkout.
 *
 * @param {Object} $ jQuery instance.
 * @package
 * @since 1.0.0
 */

/* global powerCouponsProgressData */
( function ( $ ) {
	'use strict';

	const PowerCouponsProgressBar = {
		/**
		 * Initialize
		 */
		init() {
			this.bindEvents();
		},

		/**
		 * Bind events
		 */
		bindEvents() {
			// Classic cart/checkout events.
			$( document.body ).on(
				'updated_cart_totals',
				this.refreshProgress.bind( this )
			);
			$( document.body ).on(
				'updated_checkout',
				this.refreshProgress.bind( this )
			);
			$( document.body ).on(
				'added_to_cart',
				this.refreshProgress.bind( this )
			);
			$( document.body ).on(
				'removed_from_cart',
				this.refreshProgress.bind( this )
			);

			// WooCommerce Blocks support.
			this.bindBlockEvents();
		},

		/**
		 * Bind WooCommerce Blocks events.
		 * Uses registerCheckoutFilters to detect cart total changes in block cart/checkout.
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

			const self = this;

			window.wc.blocksCheckout.registerCheckoutFilters(
				'powerCouponsProgressBar',
				{
					totalValue( defaultValue ) {
						self.refreshProgress();
						return defaultValue;
					},
					showApplyCouponNotice( defaultValue ) {
						self.refreshProgress();
						return defaultValue;
					},
					showRemoveCouponNotice( defaultValue ) {
						self.refreshProgress();
						return defaultValue;
					},
				}
			);
		},

		/**
		 * Refresh progress data via AJAX.
		 * Debounced to avoid rapid-fire requests during block updates.
		 */
		refreshProgress() {
			if ( ! window.powerCouponsProgressData ) {
				return;
			}

			// Debounce: cancel any pending request timer.
			if ( this._refreshTimer ) {
				clearTimeout( this._refreshTimer );
			}

			this._refreshTimer = setTimeout( () => {
				// A reply to an older request describes an older cart, so drop it.
				if ( this._request ) {
					this._request.abort();
				}

				const request = $.ajax( {
					url: powerCouponsProgressData.ajaxUrl,
					type: 'POST',
					data: {
						action: 'power_coupons_get_progress_data',
						nonce: powerCouponsProgressData.nonce,
					},
					success: ( response ) => {
						if (
							request !== this._request ||
							! response.success ||
							! response.data ||
							! response.data.sources
						) {
							return;
						}

						this.updateDOM(
							response.data.sources,
							response.data.html || ''
						);
					},
					complete: () => {
						if ( request === this._request ) {
							this._request = null;
						}
					},
				} );

				this._request = request;
			}, 300 );
		},

		/**
		 * Find a bar by its source key.
		 *
		 * Matched by attribute value rather than a built selector, so a key can never be read as selector syntax.
		 *
		 * @param {jQuery} $scope Element(s) to search in.
		 * @param {string} key    Source key.
		 * @return {jQuery} The matching bar, if any.
		 */
		findGoal( $scope, key ) {
			return $scope
				.find( '[data-source-key]' )
				.filter(
					( index, el ) =>
						el.getAttribute( 'data-source-key' ) === key
				)
				.first();
		},

		/**
		 * Update DOM elements with fresh progress data.
		 *
		 * @param {Array}  sources Array of source progress objects, in display order.
		 * @param {string} html    Rendered bars for these sources. Empty when the server does not send it.
		 */
		updateDOM( sources, html ) {
			const self = this;
			const sourcesByKey = new Map(
				sources.map( ( source ) => [ source.key, source ] )
			);
			const $rendered = html ? $( $.parseHTML( html ) ) : $();

			$( '.power-coupons-progress-container' ).each( function () {
				const $container = $( this );

				// Add the bars that became eligible after page load, keeping the server's order.
				let $previous = $();
				sources.forEach( ( source ) => {
					let $goal = self.findGoal( $container, source.key );

					if ( ! $goal.length ) {
						$goal = self.findGoal( $rendered, source.key ).clone();
						if ( ! $goal.length ) {
							return;
						}

						if ( $previous.length ) {
							$goal.insertAfter( $previous );
						} else {
							$container.prepend( $goal );
						}
					}

					$previous = $goal;
				} );

				// Show and refresh the bars that still apply, hide the ones that no longer do.
				let hasVisibleGoal = false;
				$container.find( '[data-source-key]' ).each( function () {
					const source = sourcesByKey.get(
						this.getAttribute( 'data-source-key' )
					);

					$( this ).toggle( !! source );
					if ( source ) {
						hasVisibleGoal = true;
						self.updateGoal( $( this ), source );
					}
				} );

				// Hide the wrapper too when none of its bars apply, so no empty box is left behind.
				$container.toggle( hasVisibleGoal );
			} );
		},

		/**
		 * Update one bar with fresh progress data.
		 *
		 * @param {jQuery} $source Bar element.
		 * @param {Object} source  Source progress object.
		 */
		updateGoal( $source, source ) {
			// Update fill width.
			$source
				.find( '.power-coupons-progress-fill' )
				.css( 'width', source.percentage + '%' );

			// Update message.
			$source
				.find( '.power-coupons-progress-text' )
				.html( source.message );

			// Update aria.
			$source
				.find( '.power-coupons-progress-track' )
				.attr( 'aria-valuenow', Math.round( source.percentage ) );

			// Toggle complete class.
			$source.toggleClass( 'complete', !! source.is_complete );
			$source
				.find( '.power-coupons-progress-fill' )
				.toggleClass( 'complete', !! source.is_complete );
			$source
				.find( '.power-coupons-progress-message' )
				.toggleClass( 'success', !! source.is_complete );
		},
	};

	// Initialize on document ready.
	$( document ).ready( () => {
		PowerCouponsProgressBar.init();
	} );
} )( jQuery );
