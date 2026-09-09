import Number from '../fields/Number';
import FieldWrapper from '../wrappers/FieldWrapper';
import { buildControlId } from './fieldUtils';

function NumberField( props ) {
	const {
		title,
		description,
		name,
		value,
		badge,
		min,
		type,
		disabled = false,
	} = props;
	const controlId = buildControlId( 'input-number', name );

	return (
		<FieldWrapper
			title={ title }
			description={ description }
			badge={ badge }
			disabled={ disabled }
			controlId={ controlId }
		>
			<div className="power_coupons-input-field-wrapper">
				<Number
					id={ controlId }
					name={ name }
					val={ value }
					badge={ badge }
					min={ min }
					type={ type }
					disabled={ disabled }
				/>
			</div>
		</FieldWrapper>
	);
}

export default NumberField;
