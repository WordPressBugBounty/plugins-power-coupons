import { __ } from '@wordpress/i18n';

/**
 * Whether Pro supports BOGO category selection.
 *
 * Pro advertises it. An older Pro drops the category lists on save, so a
 * category-only offer would save and then never trigger; the create modal and
 * the preview both hide categories without it.
 *
 * @return {boolean} Whether category selection is available.
 */
export const supportsCategorySelection = () =>
	!! window.powerCouponsSettings?.bogo_category_selection;

// Copy that differs when categories are available: [ with categories, products only ].
const CATEGORY_AWARE_TEXT = {
	buyRequired: [
		__(
			'Please select at least one product or category to buy.',
			'power-coupons'
		),
		__( 'Please select at least one product to buy.', 'power-coupons' ),
	],
	getRequired: [
		__(
			'Please select at least one product or category to get.',
			'power-coupons'
		),
		__( 'Please select at least one product to get.', 'power-coupons' ),
	],
	triggerHeading: [
		__( 'Specific Products / Categories', 'power-coupons' ),
		__( 'Specific Products', 'power-coupons' ),
	],
	triggerDescription: [
		__(
			'Trigger only for selected products or categories.',
			'power-coupons'
		),
		__( 'Trigger only for selected products.', 'power-coupons' ),
	],
};

/**
 * Copy for the current category capability.
 *
 * @param {string} key Key in CATEGORY_AWARE_TEXT.
 * @return {string} Translated text.
 */
export const categoryAwareText = ( key ) =>
	CATEGORY_AWARE_TEXT[ key ][ supportsCategorySelection() ? 0 : 1 ];
