/**
 * Group a flat field array into the sections the PHP already declares.
 *
 * Every settings field may carry a `section` key, and the first field of each
 * section carries the `section_title` that names it. That grouping has been
 * authored on the PHP side since the settings screens shipped, but nothing ever
 * read it: `SectionRenderer` looked for a `fields.sections` object that the
 * registration code never builds, so every tab fell through to the flat branch
 * and rendered as one undivided list.
 *
 * This reads the grouping off the fields themselves, so the PHP stays the
 * single source of truth and no registration code has to change shape.
 *
 * Fields with no `section` are collected into one leading untitled group. That
 * keeps a tab whose fields predate sections — or one registered by an add-on
 * that never adopted them — rendering exactly as it does today.
 */

import { __ } from '@wordpress/i18n';

const UNGROUPED = '__ungrouped';

/**
 * Headings for sections whose fields declare none.
 *
 * PRO 1.0.4 already splits its tabs into these sections but names none of
 * them; the release that adds `section_title` may reach a store after this
 * free build does, since free updates from wp.org and PRO waits on a licence.
 * In that window free supplies the heading itself, so the grouping renders
 * the same as it will once PRO catches up. Keyed by tab slug, then section.
 *
 * @return {Object} Tab slug → section key → heading.
 */
const getSectionTitleFallbacks = () => ( {
	power_coupons_points: {
		general: __( 'Loyalty Rewards Status', 'power-coupons' ),
		expiry: __( 'Credits Expiry', 'power-coupons' ),
		display: __( 'Where Credits Appear', 'power-coupons' ),
		earning: __( 'How Credits Are Earned', 'power-coupons' ),
		redemption: __( 'How Redemption Works', 'power-coupons' ),
	},
	power_coupons_gift_cards: {
		general: __( 'Gift Card Basics', 'power-coupons' ),
		restrictions: __( 'Redemption Restrictions', 'power-coupons' ),
	},
	power_coupons_text: {
		points_text: __( 'Credit Labels and Messages', 'power-coupons' ),
		gift_cards_text: __( 'Gift Card Text', 'power-coupons' ),
	},
} );

/**
 * Sort fields by their `priority`, treating a missing priority as 0.
 *
 * @param {Array} fields Field definitions.
 * @return {Array} A new sorted array.
 */
export function sortFieldsByPriority( fields ) {
	const fieldsArray = Object.values( fields || {} );

	if ( ! Array.isArray( fieldsArray ) ) {
		return fieldsArray;
	}

	return [ ...fieldsArray ].sort( ( a, b ) => {
		const aPriority = typeof a.priority === 'number' ? a.priority : 0;
		const bPriority = typeof b.priority === 'number' ? b.priority : 0;
		return aPriority - bPriority;
	} );
}

/**
 * Group fields by their `section`, preserving priority order.
 *
 * Groups come back in the order their first field appears, so the priority sort
 * decides both the order of fields within a section and the order of the
 * sections themselves. A tab with no sectioned fields yields a single untitled
 * group, which callers render as one plain card.
 *
 * A section whose fields carry no `section_title` takes free's own heading for
 * it when one is known (see `getSectionTitleFallbacks`), so older PRO field
 * definitions still render as titled groups rather than blank cards.
 *
 * @param {Array}  fields Field definitions.
 * @param {string} tabKey Settings tab slug, used to look up fallback headings.
 * @return {Array<{key: string, title: string, fields: Array}>} Ordered groups.
 */
export function groupFieldsBySection( fields, tabKey = '' ) {
	const sorted = sortFieldsByPriority( fields );

	if ( ! Array.isArray( sorted ) ) {
		return [];
	}

	const fallbacks = getSectionTitleFallbacks()[ tabKey ] || {};
	const groups = new Map();

	sorted.forEach( ( field ) => {
		const key = field.section || UNGROUPED;

		if ( ! groups.has( key ) ) {
			groups.set( key, { key, title: '', fields: [] } );
		}

		const group = groups.get( key );

		// The title lives on whichever field declares it — conventionally the
		// first of the section, but don't depend on that.
		if ( ! group.title && field.section_title ) {
			group.title = field.section_title;
		}

		group.fields.push( field );
	} );

	groups.forEach( ( group ) => {
		if ( ! group.title && fallbacks[ group.key ] ) {
			group.title = fallbacks[ group.key ];
		}
	} );

	return Array.from( groups.values() );
}

/**
 * Whether a set of groups carries no section titles at all.
 *
 * Callers use this to keep the single-card layout for tabs whose fields
 * declare no `section_title` and for which free knows no fallback heading
 * either. One untitled group is simply a flat list; several must collapse to
 * the same thing, because splitting them would only stack blank cards with no
 * heading to say why.
 *
 * @param {Array} groups Result of `groupFieldsBySection`.
 * @return {boolean} True when there is nothing to visually separate.
 */
export function hasNoTitledGroups( groups ) {
	return ! groups.some( ( group ) => group.title );
}

/**
 * Sub-tabs of a tab that actually have fields registered against them.
 *
 * PRO registers the fields for several sub-tabs, so with PRO inactive those
 * sub-tabs exist in the tab definition but would render an empty panel. Both
 * the sidebar and the field container need the same answer, so it lives here.
 *
 * @param {string} tabKey Settings tab slug.
 * @return {Array} Sub-tab definitions that have at least one field.
 */
export function getVisibleSubtabs( tabKey ) {
	const tab = window.powerCouponsSettings?.settings_tabs?.[ tabKey ] || {};
	const subtabs = tab.subtabs || [];
	const fields =
		window.powerCouponsSettings?.settings_fields?.[ tabKey ] || [];

	return subtabs.filter( ( subtab ) =>
		fields.some( ( field ) => field.subtab === subtab.slug )
	);
}
