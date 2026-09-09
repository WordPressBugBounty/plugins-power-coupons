import { useState, useRef, useEffect } from 'react';
import { Select } from '@bsf/force-ui';

import { useStateValue } from '../Data';
import { debounce } from 'lodash';

import FieldWrapper from '../wrappers/FieldWrapper';
import { parseFieldName, getNestedValue, setNestedValue } from './fieldUtils';

function DropdownField( props ) {
	const { title, description, name, optionsArray, disabled = false } = props;
	const [ data, dispatch ] = useStateValue();
	const parts = parseFieldName( name );
	const currentValue = getNestedValue( data, parts );

	const debounceDispatch = useRef(
		debounce( async ( dispatchParams ) => {
			dispatch( dispatchParams );
		}, 500 )
	).current;

	useEffect( () => {
		return () => {
			debounceDispatch.cancel();
		};
	}, [ debounceDispatch ] );

	const dbValue =
		Object.keys( optionsArray ).find(
			( key ) => optionsArray[ key ].id === currentValue
		) || '0';
	const [ selected, setSelected ] = useState( optionsArray[ dbValue ] );

	function handleOnChange( selectedValue ) {
		if ( disabled ) {
			return;
		}
		const currentStoredValue = getNestedValue( data, parts );
		if ( currentStoredValue !== selectedValue ) {
			const newData = setNestedValue( data, parts, selectedValue );
			debounceDispatch( {
				type: 'CHANGE',
				data: newData,
			} );
		}
	}

	// Generate a unique ID for this dropdown for better accessibility
	const dropdownId = `dropdown-${ name.replace( /[\[\]]/g, '-' ) }`;

	return (
		<FieldWrapper
			title={ title }
			description={ description }
			disabled={ disabled }
			controlId={ dropdownId }
		>
			{ /* Wide enough for the longest option label — at 25% the value
			itself was being truncated to "Drawer (Slid…". */ }
			<div className="flex-grow w-full sm:w-auto sm:min-w-[16rem]">
				<div className="relative mt-1 w-full">
					<Select
						id={ dropdownId }
						size="md"
						value={ selected }
						by="id"
						disabled={ disabled }
						onChange={ ( option ) => {
							// Guard the visible selection too, not just the
							// write: repainting the label while
							// `handleOnChange` bails would leave the field
							// showing a value it never saved.
							if ( disabled ) {
								return;
							}
							setSelected( option );
							handleOnChange( option.id );
						} }
					>
						{ /* The settings app is wrapped in a form, so an
						untyped button would submit it. */ }
						<Select.Button
							type="button"
							className="w-full"
							aria-label={ title }
							disabled={ disabled }
							render={ ( option ) => option?.name }
						/>
						<Select.Options>
							{ optionsArray.map( ( option ) => (
								<Select.Option
									key={ option.id }
									value={ option }
								>
									{ option.name }
								</Select.Option>
							) ) }
						</Select.Options>
					</Select>
				</div>
				<input
					type="hidden"
					name={ name }
					value={ selected.id }
					aria-hidden="true"
				/>
			</div>
		</FieldWrapper>
	);
}

export default DropdownField;
