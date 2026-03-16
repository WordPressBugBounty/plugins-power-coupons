import { useStateValue } from '../Data';
import ColorField from '../fields/ColorField';
import DropdownField from '../fields/DropdownField';
import NumberField from '../fields/NumberField';
import TextField from '../fields/TextField';
import ToggleField from '../fields/ToggleField';
import CouponTemplatePicker from '../fields/CouponTemplatePicker';

const componentMap = {
	toggle: ToggleField,
	dropdown: DropdownField,
	text: TextField,
	number: NumberField,
	color: ColorField,
	coupon_template_picker: CouponTemplatePicker,
};

const getValueFromName = ( name, data ) => {
	const parts = name.split( /[\[\]]/ ).filter( Boolean );
	if ( parts.length === 2 ) {
		return data[ parts[ 0 ] ][ parts[ 1 ] ];
	}
	return data[ name ];
};

const evaluateConditions = ( conditions, data ) => {
	if ( ! conditions ) {
		return true;
	}

	return conditions.fields.every( ( cond ) => {
		const val = getValueFromName( cond.name, data );

		if ( undefined === val ) {
			// Most probably Pro plugin is deactivated.
			return true;
		}

		switch ( cond.operator ) {
			case '!==':
				return val !== cond.value;
			case '===':
			default:
				return val === cond.value;
		}
	} );
};

function FieldRenderer( { field, disabled = false } ) {
	const stateValue = useStateValue();
	const [ data ] = stateValue;
	const FieldComponent = componentMap[ field.type ];

	if ( ! FieldComponent ) {
		return null;
	}

	if ( ! evaluateConditions( field.conditions, data ) ) {
		return null;
	}

	const props = {
		title: field.label,
		description: field.description,
		name: field.name,
		badge: field.badge,
		min: field.min,
		max: field.max,
		disabled,
	};

	props.value = getValueFromName( field.name, data );

	if ( field.options ) {
		props.optionsArray = field.options;
	}
	if ( field.type_attr ) {
		props.type = field.type_attr;
	}
	if ( field.default_var && field.type === 'color' ) {
		props.default = data.color_default_vars[ field.default_var ];
	}

	return <FieldComponent { ...props } />;
}

export default FieldRenderer;
