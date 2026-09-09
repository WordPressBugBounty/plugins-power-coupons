import { useState, useRef, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import { Switch } from '@bsf/force-ui';
import { useStateValue } from '../Data';
import { debounce } from 'lodash';
import FieldWrapper from '../wrappers/FieldWrapper';
import ConfirmationModal from '../common/ConfirmationModal';
import {
	buildControlId,
	parseFieldName,
	getNestedValue,
	setNestedValue,
} from './fieldUtils';

function ToggleField( props ) {
	const {
		title,
		description,
		name,
		disabled = false,
		confirmOff,
		confirmTitle,
		confirmMessage,
		confirmLabel,
	} = props;
	const [ data, dispatch ] = useStateValue();
	const parts = parseFieldName( name );
	const initialValue = getNestedValue( data, parts );
	const [ enable, setEnable ] = useState( initialValue );
	const [ confirming, setConfirming ] = useState( false );

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

	function applyChange( newValue ) {
		setEnable( newValue );
		if ( 'function' === typeof props.manageState ) {
			props.manageState( newValue );
		}

		const newData = setNestedValue( data, parts, newValue );

		debounceDispatch( {
			type: 'CHANGE',
			data: newData,
		} );
	}

	function handleOnChange( state ) {
		if ( disabled ) {
			return;
		}

		const newValue = ! state;

		// Switching a kill-switch off is the highest-consequence interaction on
		// these screens and used to be the lowest-friction one: a single click,
		// no confirmation, applied to a live store, with a two-second toast as
		// the only notice. Turning one back on stays a single click.
		if ( confirmOff && ! newValue ) {
			setConfirming( true );
			return;
		}

		applyChange( newValue );
	}

	const toggleId = buildControlId( 'toggle', name );

	return (
		<>
			{ /* Switch is 20px tall at size "sm", under the 24px WCAG 2.2
			target floor, so these render at "md". */ }
			<FieldWrapper
				title={ title }
				description={ description }
				disabled={ disabled }
				controlId={ toggleId }
			>
				<div className="flex items-center min-h-[1.5rem] py-0.5">
					<Switch
						id={ toggleId }
						aria-label={ `${ title } - ${
							enable
								? __( 'Enabled', 'power-coupons' )
								: __( 'Disabled', 'power-coupons' )
						}` }
						aria-checked={ enable }
						value={ enable }
						name={ name }
						disabled={ disabled }
						onChange={ () => {
							handleOnChange( enable );
						} }
						onKeyDown={ ( e ) => {
							// Handle keyboard events for accessibility
							if ( e.key === 'Enter' || e.key === ' ' ) {
								e.preventDefault();
								handleOnChange( enable );
							}
						} }
						size="md"
						className="border-none power_coupons-toggle-field"
						role="switch"
					/>
				</div>
			</FieldWrapper>
			{ confirmOff && (
				<ConfirmationModal
					isOpen={ confirming }
					onClose={ () => setConfirming( false ) }
					onConfirm={ () => {
						setConfirming( false );
						applyChange( false );
					} }
					title={
						confirmTitle || __( 'Turn this off?', 'power-coupons' )
					}
					message={
						confirmMessage ||
						__(
							'This takes effect on your live store straight away.',
							'power-coupons'
						)
					}
					confirmText={
						confirmLabel || __( 'Turn off', 'power-coupons' )
					}
				/>
			) }
		</>
	);
}

export default ToggleField;
