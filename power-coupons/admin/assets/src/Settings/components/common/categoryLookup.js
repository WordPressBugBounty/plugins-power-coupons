/**
 * Look up product category names by term ID.
 *
 * Shared by the category picker and the BOGO offer preview. Resolves with the
 * categories that still exist, as `[ { id, name } ]`; a deleted category is
 * simply missing from the result. Rejects when the request or the endpoint
 * fails, so callers can tell "not found" apart from "could not load".
 *
 * @param {Array<number|string>} ids Category term IDs.
 * @return {Promise<Array<{id: number, name: string}>>} Matching categories.
 */
export const fetchCategoriesByIds = async ( ids ) => {
	const formData = new FormData();
	formData.append( 'action', 'power_coupons_get_categories_by_ids' );
	formData.append(
		'_wpnonce',
		window.powerCouponsSettings?.update_nonce || ''
	);
	ids.forEach( ( id, index ) => formData.append( `ids[${ index }]`, id ) );

	const response = await fetch( ajaxurl, {
		method: 'POST',
		body: formData,
	} );
	const result = await response.json();

	if ( ! result?.success || ! Array.isArray( result.data ) ) {
		throw new Error( 'Category lookup failed' );
	}

	return result.data.map( ( category ) => ( {
		id: Number( category.id ),
		name: category.name,
	} ) );
};
