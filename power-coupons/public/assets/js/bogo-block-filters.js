/**
 * Hide the remove link of locked BOGO rewards in the Cart, Checkout and Mini-Cart blocks.
 *
 * The classic cart hides it server-side, but the blocks decide in JavaScript
 * through the `showRemoveItemLink` checkout filter. Power Coupons Pro flags the
 * locked lines in the Store API (`extensions['power-coupons'].bogo_locked`) and
 * enqueues this script, with `wc-blocks-checkout` as a dependency, wherever one
 * of those blocks renders.
 *
 * @since 1.0.9
 */
( () => {
	const blocksCheckout = window.wc && window.wc.blocksCheckout;

	if (
		! blocksCheckout ||
		typeof blocksCheckout.registerCheckoutFilters !== 'function'
	) {
		return;
	}

	blocksCheckout.registerCheckoutFilters( 'power-coupons-bogo-locked', {
		showRemoveItemLink: ( value, extensions, args ) => {
			const cartItemExtensions =
				( args && args.cartItem && args.cartItem.extensions ) ||
				extensions ||
				{};
			const data = cartItemExtensions[ 'power-coupons' ];

			return data && data.bogo_locked ? false : value;
		},
	} );
} )();
