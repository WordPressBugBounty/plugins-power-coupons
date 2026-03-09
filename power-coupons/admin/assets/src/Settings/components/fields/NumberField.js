import Number from '../fields/Number';
import FieldWrapper from '../wrappers/FieldWrapper';

function NumberField( props ) {
	const { title, description, name, value, badge, min, type } = props;

	return (
		<FieldWrapper
			title={ title }
			description={ description }
			badge={ badge }
		>
			<div className="power_coupons-input-field-wrapper">
				<Number
					name={ name }
					val={ value }
					badge={ badge }
					min={ min }
					type={ type }
				/>
			</div>
		</FieldWrapper>
	);
}

export default NumberField;
