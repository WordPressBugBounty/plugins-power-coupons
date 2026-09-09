/**
 * Persisted onboarding state.
 *
 * The wizard used to keep its step and answers in component state alone, so a
 * reload or a browser Back sent the merchant back to step one with nothing
 * saved. Everything worth surviving a reload goes through here.
 *
 * Ported from the CartFlows guided setup (admin-core/assets/src/onboarding/
 * utils/persistedState.js) so both wizards behave the same way.
 */

const STORAGE_KEY = 'power_coupons_onboarding_state';

/**
 * Shape of the snapshot this build understands.
 *
 * A saved answer always beats the server default, so a snapshot written before
 * a default changed would keep resurrecting the old answer until onboarding was
 * finished or exited. Bump this whenever the defaults change meaningfully and
 * stale snapshots are dropped instead.
 */
const SCHEMA_VERSION = 2;

/**
 * Read the persisted snapshot.
 *
 * @return {Object} Saved values, or an empty object when storage is unavailable
 *                  or the snapshot predates the current schema.
 */
export const readPersistedState = () => {
	try {
		const saved =
			JSON.parse( window.localStorage.getItem( STORAGE_KEY ) ) || {};

		return SCHEMA_VERSION === saved.version ? saved : {};
	} catch ( err ) {
		return {};
	}
};

/**
 * Merge a patch into the persisted snapshot.
 *
 * @param {Object} patch Key/value pairs to store.
 */
export const writePersistedState = ( patch ) => {
	try {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify( {
				...readPersistedState(),
				...patch,
				version: SCHEMA_VERSION,
			} )
		);
	} catch ( err ) {
		// Storage unavailable (private mode / quota) — state simply won't survive reload.
	}
};

/**
 * Drop the snapshot. Called once onboarding completes or is exited.
 */
export const clearPersistedState = () => {
	try {
		window.localStorage.removeItem( STORAGE_KEY );
	} catch ( err ) {
		// Nothing to clear.
	}
};

/**
 * Overlay saved answers onto the server-provided defaults.
 *
 * Only step keys present in the defaults are restored — a stale snapshot from
 * an older plugin version can never introduce keys the server won't accept.
 *
 * @param {Object} defaults Server-provided default answers, keyed by step index.
 * @return {Object} Hydrated answers.
 */
export const hydrateData = ( defaults ) => {
	const saved = readPersistedState().data || {};
	const hydrated = { ...defaults };

	Object.keys( defaults ).forEach( ( stepIndex ) => {
		if ( saved[ stepIndex ] ) {
			hydrated[ stepIndex ] = {
				...defaults[ stepIndex ],
				...saved[ stepIndex ],
			};
		}
	} );

	return hydrated;
};
