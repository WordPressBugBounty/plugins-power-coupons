/**
 * Field utilities for handling nested field names
 *
 * @package
 */

/**
 * Parse field name like "general[enable_plugin]" into array of parts
 *
 * @param {string} name Field name with bracket notation
 * @return {Array} Array of field name parts
 */
export const parseFieldName = ( name ) => {
	const parts = name.split( /[\[\]]/ ).filter( Boolean );
	return parts;
};

/**
 * Build a stable DOM id for a field's control from its setting name.
 *
 * Deterministic on purpose. The controls used to fall back to React's
 * generated ids, which change on every render, so a `<label for>` could never
 * be pointed at one and the visible caption stayed a sibling that assistive
 * tech had no way to connect to the input.
 *
 * @param {string} prefix Short control-type prefix, e.g. `input-text`.
 * @param {string} name   Field name with bracket notation.
 * @return {string} Stable id, e.g. `input-text-general-show_on_cart`.
 */
export const buildControlId = ( prefix, name ) =>
	`${ prefix }-${ String( name )
		.replace( /[[\]]/g, '-' )
		.replace( /-+$/, '' ) }`;

/**
 * Get nested value from object using array of keys
 *
 * @param {Object} obj   Object to get value from
 * @param {Array}  parts Array of keys to traverse
 * @return {*} Value at nested path
 */
export const getNestedValue = ( obj, parts ) => {
	return parts.reduce( ( acc, part ) => acc?.[ part ], obj );
};

/**
 * Set nested value in object using array of keys (immutable)
 *
 * @param {Object} obj   Object to set value in
 * @param {Array}  parts Array of keys to traverse
 * @param {*}      value Value to set
 * @return {Object} New object with value set
 */
export const setNestedValue = ( obj, parts, value ) => {
	const newObj = { ...obj };
	let current = newObj;

	for ( let i = 0; i < parts.length - 1; i++ ) {
		if (
			! current[ parts[ i ] ] ||
			typeof current[ parts[ i ] ] !== 'object'
		) {
			current[ parts[ i ] ] = {};
		} else {
			current[ parts[ i ] ] = { ...current[ parts[ i ] ] };
		}
		current = current[ parts[ i ] ];
	}

	current[ parts[ parts.length - 1 ] ] = value;
	return newObj;
};
