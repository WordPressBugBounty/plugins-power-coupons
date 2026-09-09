/**
 * Screen-reader announcement that a wizard's save landed.
 *
 * The wizards hold their last step on screen for a moment after saving so the
 * check can be seen; this is the same confirmation for someone who cannot see
 * it. A live region only announces text that changes while it is already in
 * the document — one inserted with its message already inside is read by
 * nothing — so this renders from the first paint and stays empty until
 * `announce` flips.
 *
 * Sits outside the step list on purpose: role="status" on a list item would
 * override its listitem role and throw off the list's child count.
 *
 * @param {Object}  props
 * @param {boolean} props.announce Whether the save has landed.
 * @param {string}  props.message  What to say when it has.
 */
const SaveStatus = ( { announce, message } ) => (
	<div role="status" className="sr-only">
		{ announce ? message : '' }
	</div>
);

export default SaveStatus;
