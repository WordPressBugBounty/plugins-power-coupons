import { useStateValue } from '../Data';
import ColorField from '../fields/ColorField';
import DropdownField from '../fields/DropdownField';
import NumberField from '../fields/NumberField';
import TextField from '../fields/TextField';
import ToggleField from '../fields/ToggleField';
import CouponTemplatePicker from '../fields/CouponTemplatePicker';
import ProductSearchField from '../fields/ProductSearchField';
import CategorySearchField from '../fields/CategorySearchField';
import PageSearchField from '../fields/PageSearchField';

const componentMap = {
	toggle: ToggleField,
	dropdown: DropdownField,
	text: TextField,
	number: NumberField,
	color: ColorField,
	coupon_template_picker: CouponTemplatePicker,
	product_search: ProductSearchField,
	category_search: CategorySearchField,
	page_search: PageSearchField,
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

/**
 * Whether a field will render anything at all.
 *
 * Callers that need to know before rendering — a section heading that must not
 * appear above an empty card, say — ask this instead of invoking the component
 * and testing the result. `FieldRenderer` is a component with hooks in it, so
 * calling it as a plain function to probe its output breaks the rules of hooks
 * and mis-orders the hook table on the next real render.
 *
 * @param {Object} field Field definition.
 * @param {Object} data  Current settings state.
 * @return {boolean} True when the field has a component and passes conditions.
 */
export function isFieldVisible( field, data ) {
	if ( ! componentMap[ field.type ] ) {
		return false;
	}

	return evaluateConditions( field.conditions, data );
}

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

	// Merge explicit disabled prop with field-level disabled_conditions.
	const isConditionDisabled = field.disabled_conditions
		? ! evaluateConditions( field.disabled_conditions, data )
		: false;

	const props = {
		title: field.label,
		description: field.description,
		name: field.name,
		badge: field.badge,
		min: field.min,
		max: field.max,
		disabled: disabled || isConditionDisabled,
	};

	// Opt-in confirmation for switches whose "off" position has consequences
	// beyond this screen.
	if ( field.confirm_off ) {
		props.confirmOff = true;
		props.confirmTitle = field.confirm_title;
		props.confirmMessage = field.confirm_message;
		props.confirmLabel = field.confirm_label;
	}

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
