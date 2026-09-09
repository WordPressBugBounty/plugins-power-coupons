/**
 * Validation messaging shared by the plugin's forms.
 *
 * Three near-identical copies had grown across the wizards and the credits
 * dialog, each with its own markup and only one of them reachable by a screen
 * reader. One implementation keeps the treatment identical wherever a field can
 * be wrong.
 *
 * The message is plain red text. The field it names already carries the error
 * outline and role="alert" carries the words to a screen reader, so an icon
 * beside them only repeated a signal that had been sent twice already.
 */

/**
 * Message for one invalid field.
 *
 * Takes an id so the field can point at it with aria-describedby. Without that
 * link the message is visible but unattached — a screen reader moving field by
 * field never reaches it.
 *
 * @param {Object} props
 * @param {string} props.id      Referenced by the field's aria-describedby.
 * @param {string} props.message What is wrong, empty when the field is valid.
 */
const FieldError = ( { id, message } ) => {
	if ( ! message ) {
		return null;
	}
	return (
		<p
			id={ id }
			role="alert"
			className="m-0 mt-1 text-field-required text-xs leading-5"
		>
			{ message }
		</p>
	);
};

export default FieldError;
