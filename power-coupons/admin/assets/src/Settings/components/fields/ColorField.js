import React from 'react';
import ColorPicker from '../fields/ColorPicker';
import FieldWrapper from '../wrappers/FieldWrapper';
import { buildControlId } from './fieldUtils';

function ColorField( props ) {
	const { title, description, disabled = false } = props;
	const controlId = buildControlId( 'colorpicker', props.name );

	return (
		<FieldWrapper
			title={ title }
			description={ description }
			disabled={ disabled }
			controlId={ controlId }
		>
			<div className="power_coupons-color-field">
				<ColorPicker
					name={ props.name }
					value={ props.value }
					defaultColor={ props.default }
					disabled={ disabled }
					triggerId={ controlId }
					labelledBy={ `${ controlId }-title` }
				/>
			</div>
		</FieldWrapper>
	);
}

export default ColorField;
