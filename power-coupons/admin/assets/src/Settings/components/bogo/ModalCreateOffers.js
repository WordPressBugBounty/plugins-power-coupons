import {
	Topbar,
	Tabs,
	Input,
	DatePicker,
	RadioButton,
	Button,
	Checkbox,
	Select,
	Switch,
} from '@bsf/force-ui';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useEffect, useRef, Fragment } from '@wordpress/element';
import Logo from '../../../../images/logo.svg';
import { BOGOPresets, getBOGOPresetData, RenderIcon } from '../common/Utils';
import { CalendarIcon, CheckIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import ProductSelector from './ProductSelector';
import FieldError from '../common/FieldError';
import SaveStatus from '../common/SaveStatus';
import useModalFocus from '../common/hooks/useModalFocus';

// How long the finished wizard stays on screen after a successful save, so the
// check on the last step is seen before the modal closes itself.
const SUCCESS_HOLD_MS = 1600;

const PROGRESS_BAR_ICONS = [
	{ value: 'tag', label: __( 'Tag', 'power-coupons' ) },
	{ value: 'truck', label: __( 'Truck', 'power-coupons' ) },
	{ value: 'gift', label: __( 'Gift', 'power-coupons' ) },
	{ value: 'percent', label: __( 'Percent', 'power-coupons' ) },
];

// ─── Shared class strings ────────────────────────────────────────────────────
//
// Each of these was written out per call site — five copies of the primary
// button and three different treatments for what is the same textarea. Naming
// them keeps the wizard's four steps identical to each other and makes a change
// one edit instead of five.

const PRIMARY_BUTTON_CLASSES =
	'font-semibold text-sm px-3 py-2 w-fit ml-auto cursor-pointer no-underline text-white hover:text-white bg-wpcolor hover:bg-wphovercolor rounded-md box-content border-none';

// Mirrors the outline, radius and focus treatment of a force-ui <Input> so a
// textarea does not read as a different family of control next to one.
const TEXTAREA_CLASSES =
	'w-full font-normal text-sm leading-6 bg-field-secondary-background placeholder-text-tertiary text-text-primary outline outline-1 outline-border-subtle border-none rounded px-3 py-2 resize-y transition-[color,box-shadow,outline] duration-200 hover:outline-border-strong focus:outline-focus-border focus:ring-2 focus:ring-toggle-on focus:ring-offset-2';

/**
 * Step heading and its one-line explanation.
 *
 * Replaces a bare <strong> plus an unstyled <p>, whose default margin left a
 * gap unrelated to the 24px rhythm the rest of the panel is built on.
 *
 * @param {Object} props
 * @param {string} props.title       Name of the step.
 * @param {string} props.description What the step is for.
 */
const SectionIntro = ( { title, description } ) => (
	<div>
		<h4 className="m-0 text-sm font-semibold text-text-primary">
			{ title }
		</h4>
		<p className="m-0 mt-1 text-sm leading-6 text-text-secondary">
			{ description }
		</p>
	</div>
);

// ─── Date helpers ────────────────────────────────────────────────────────────

const toYMD = ( date ) => format( date, 'yyyy-MM-dd' );

// Guard against MySQL DATETIME strings ('2026-03-23 00:00:00') and invalid values.
const parseDate = ( val ) => {
	if ( ! val ) {
		return undefined;
	}
	// Slice to first 10 chars so '2026-03-23 00:00:00' → '2026-03-23'
	const d = new Date( String( val ).slice( 0, 10 ) + 'T00:00:00' );
	return isNaN( d.getTime() ) ? undefined : d;
};

const toDisplay = ( date ) => {
	if ( ! date || isNaN( date.getTime() ) ) {
		return '';
	}
	return format( date, 'MMM d, yyyy' );
};

// ─── DateField component ─────────────────────────────────────────────────────

const DateField = ( { id, label, value, placeholder, onChange, helper } ) => {
	const [ open, setOpen ] = useState( false );
	const [ dropUp, setDropUp ] = useState( false );
	const dateRef = useRef( null );

	useEffect( () => {
		if ( ! open ) {
			return;
		}
		const handler = ( e ) => {
			if ( dateRef.current && ! dateRef.current.contains( e.target ) ) {
				setOpen( false );
			}
		};
		document.addEventListener( 'mousedown', handler );
		return () => document.removeEventListener( 'mousedown', handler );
	}, [ open ] );

	const handleToggle = () => {
		if ( ! open && dateRef.current ) {
			const rect = dateRef.current.getBoundingClientRect();
			// Single-month DatePicker is ~350px tall; flip up if not enough room below.
			setDropUp( window.innerHeight - rect.bottom < 370 );
		}
		setOpen( ( v ) => ! v );
	};

	const selected = parseDate( value );

	// Escape closes the picker and hands focus back to its button. The wizard
	// around it also listens for Escape, and leaves this to the picker while
	// the popup is up.
	const handleKeyDown = ( event ) => {
		if ( open && 'Escape' === event.key ) {
			event.preventDefault();
			setOpen( false );
			dateRef.current?.querySelector( 'button' )?.focus();
		}
	};

	return (
		<div
			className="flex flex-col gap-1.5"
			ref={ dateRef }
			onKeyDown={ handleKeyDown }
		>
			<label
				htmlFor={ id }
				className="text-sm font-medium text-text-primary"
			>
				{ label }
			</label>
			<div className="relative">
				<button
					id={ id }
					type="button"
					onClick={ handleToggle }
					className="w-full h-10 px-3.5 flex items-center gap-2 bg-white text-text-primary outline outline-1 outline-border-subtle border-none transition-[color,box-shadow,outline] duration-200 rounded text-sm text-left cursor-pointer hover:outline-border-strong focus:outline-focus-border focus:ring-2 focus:ring-toggle-on focus:ring-offset-2"
				>
					<CalendarIcon className="w-4 h-4 text-text-tertiary flex-shrink-0" />
					<span
						className={
							value ? 'text-text-primary' : 'text-text-tertiary'
						}
					>
						{ value
							? toDisplay( parseDate( value ) )
							: placeholder }
					</span>
				</button>
				{ open && (
					<div
						className={ `pc-date-picker-popup absolute z-50 ${
							dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
						} left-0 shadow-lg rounded-md` }
					>
						<DatePicker
							selectionType="single"
							variant="normal"
							selected={ selected }
							onApply={ ( date ) => {
								onChange( toYMD( date ) );
								setOpen( false );
							} }
							onCancel={ () => {
								onChange( '' );
								setOpen( false );
							} }
							cancelButtonText={ __( 'Clear', 'power-coupons' ) }
						/>
					</div>
				) }
			</div>
			{ helper && (
				<p className="m-0 text-xs text-text-secondary leading-snug">
					{ helper }
				</p>
			) }
		</div>
	);
};

// ─── Offer type groups ───────────────────────────────────────────────────────

const BUY_X_TYPES = [
	'buy-x-get-x-free',
	'buy-x-get-y',
	'buy-x-get-y-at-x-percent-off',
];
const SPEND_X_TYPES = [
	'spend-x-get-y-free',
	'spend-x-get-y-at-x-percent-off',
	'spend-x-get-free-shipping',
];

// Offer types where the admin must pick specific "Products to Get".
const TYPES_REQUIRING_GET_PRODUCTS = [
	'buy-x-get-y',
	'buy-x-get-y-at-x-percent-off',
	'spend-x-get-y-free',
	'spend-x-get-y-at-x-percent-off',
];

// ─── Per-tab validation helpers ───────────────────────────────────────────────

const validateTab1 = ( formData ) => {
	const errors = {};
	if ( ! ( formData.name || '' ).trim() ) {
		errors.name = __( 'Offer name is required.', 'power-coupons' );
	}
	return errors;
};

const validateTab2 = ( formData ) => {
	const errors = {};
	const {
		key,
		buy_quantity,
		get_quantity,
		spend_amount,
		discount_type,
		discount_percent,
		discount_amount,
	} = formData;

	// These fields use uncontrolled inputs (defaultValue), so when the admin has not
	// touched a field its formData entry is undefined. Use ?? to fall back to the same
	// default that the Input renders, so untouched-but-valid fields never raise errors.
	const buyQtyRaw = buy_quantity ?? '1';
	const getQtyRaw = get_quantity ?? '1';
	const spendAmtRaw = spend_amount ?? '50';
	const discPctRaw = discount_percent ?? '10';
	const discAmtRaw = discount_amount ?? '5';

	if ( BUY_X_TYPES.includes( key ) ) {
		if ( ! buyQtyRaw || parseInt( buyQtyRaw ) < 1 ) {
			errors.buy_quantity = __(
				'Buy quantity must be at least 1.',
				'power-coupons'
			);
		}
	}

	const needsGetQty =
		BUY_X_TYPES.includes( key ) ||
		( SPEND_X_TYPES.includes( key ) &&
			key !== 'spend-x-get-free-shipping' );

	if ( needsGetQty && ( ! getQtyRaw || parseInt( getQtyRaw ) < 1 ) ) {
		errors.get_quantity = __(
			'Get quantity must be at least 1.',
			'power-coupons'
		);
	}

	if ( SPEND_X_TYPES.includes( key ) ) {
		if ( ! spendAmtRaw || parseFloat( spendAmtRaw ) <= 0 ) {
			errors.spend_amount = __(
				'Minimum spend amount must be greater than 0.',
				'power-coupons'
			);
		}
	}

	if ( ( discount_type || 'free' ) === 'percentage' ) {
		const pct = parseFloat( discPctRaw );
		if ( isNaN( pct ) || pct <= 0 || pct > 100 ) {
			errors.discount_percent = __(
				'Discount percentage must be between 1 and 100.',
				'power-coupons'
			);
		}
	}

	if ( ( discount_type || 'free' ) === 'fixed' ) {
		const amt = parseFloat( discAmtRaw );
		if ( isNaN( amt ) || amt <= 0 ) {
			errors.discount_amount = __(
				'Fixed discount amount must be greater than 0.',
				'power-coupons'
			);
		}
	}

	return errors;
};

const validateTab3 = ( formData ) => {
	const errors = {};
	const { key, trigger_type, buy_product_ids, get_product_ids } = formData;

	if (
		BUY_X_TYPES.includes( key ) &&
		( trigger_type || 'any_product' ) === 'specific_products'
	) {
		if ( ! buy_product_ids || buy_product_ids.length === 0 ) {
			errors.buy_product_ids = __(
				'Please select at least one product to buy.',
				'power-coupons'
			);
		}
	}

	if ( TYPES_REQUIRING_GET_PRODUCTS.includes( key ) ) {
		if ( ! get_product_ids || get_product_ids.length === 0 ) {
			errors.get_product_ids = __(
				'Please select at least one product to get.',
				'power-coupons'
			);
		}
	}

	return errors;
};

// ─── Error and field components ──────────────────────────────────────────────

/**
 * Banner for an error the server reported about the whole form.
 *
 * @param {Object} props
 * @param {string} props.message What went wrong.
 */
const FormErrorBanner = ( { message } ) => {
	if ( ! message ) {
		return null;
	}
	return (
		<div
			role="alert"
			className="bg-badge-background-red border border-solid border-badge-border-red rounded-md px-4 py-3 text-badge-color-red text-sm leading-6"
		>
			{ message }
		</div>
	);
};

/**
 * Classes for the wrapper of an invalid Force UI Input.
 *
 * Force UI's own error state only swaps the outline to focus-error-border
 * (#FECACA), 1.17:1 against the neutral outline beside it, so an invalid field
 * looked exactly like a valid one. Its className prop lands on a wrapper div,
 * not the input, so the field is recoloured from outside with the token its
 * message already uses. The hover and focus variants carry one more selector
 * than Force UI's, so the state survives both.
 */
const ERROR_OUTLINE =
	'[&_input]:outline-support-error [&_input:hover]:outline-support-error [&_input:focus]:outline-support-error';

/**
 * Numeric field with its validation message.
 *
 * Six near-identical copies of input-plus-error stood here, at two different
 * sizes, none of them naming the field its message belonged to.
 *
 * @param {Object} props
 * @param {string} props.id    Field id; the message id is derived from it.
 * @param {string} props.error Validation message, empty when valid.
 */
const NumberField = ( { id, error, ...inputProps } ) => {
	const errorId = `${ id }-error`;
	return (
		<div
			className={ `flex flex-col gap-1${
				error ? ` ${ ERROR_OUTLINE }` : ''
			}` }
		>
			<Input
				id={ id }
				type="number"
				size="md"
				error={ !! error }
				{ ...( error && {
					'aria-invalid': 'true',
					'aria-describedby': errorId,
				} ) }
				{ ...inputProps }
			/>
			<FieldError id={ errorId } message={ error } />
		</div>
	);
};

// ─── Tab definitions ──────────────────────────────────────────────────────────

const FormTabs = [
	{
		slug: 'basic-settings',
		title: __( 'Basic Settings', 'power-coupons' ),
		content: ( {
			formData,
			setFormData,
			presetData,
			setActiveTab,
			errors,
			setErrors,
			clearError,
		} ) => {
			const handleSaveAndContinue = () => {
				const tabErrors = validateTab1( formData );
				if ( Object.keys( tabErrors ).length > 0 ) {
					setErrors( tabErrors );
					return;
				}
				setErrors( {} );
				setActiveTab( FormTabs[ 1 ].slug );
			};

			return (
				<>
					<SectionIntro
						title={ __( 'Offer Basics', 'power-coupons' ) }
						description={ __(
							'Define the core settings for your offer.',
							'power-coupons'
						) }
					/>

					<div className="flex flex-col gap-4">
						{ /* Offer Name — required */ }
						<div
							className={ `flex flex-col gap-1${
								errors.name ? ` ${ ERROR_OUTLINE }` : ''
							}` }
						>
							<Input
								value={ formData.name ?? '' }
								id="bogo-input-offer-name"
								label={ __( 'Offer Name', 'power-coupons' ) }
								size="md"
								type="text"
								error={ !! errors.name }
								{ ...( errors.name && {
									'aria-invalid': 'true',
									'aria-describedby':
										'bogo-input-offer-name-error',
								} ) }
								placeholder={ __(
									'E.g. Buy X Get X @ 10%',
									'power-coupons'
								) }
								onChange={ ( value ) => {
									setFormData( 'name', value );
									clearError( 'name' );
								} }
							/>
							<FieldError
								id="bogo-input-offer-name-error"
								message={ errors.name }
							/>
						</div>

						<div className="flex flex-col items-start gap-1.5">
							<label
								htmlFor="bogo-textarea-offer-description"
								className="text-sm font-medium text-text-primary"
							>
								{ __( 'Description', 'power-coupons' ) }
							</label>
							<textarea
								id="bogo-textarea-offer-description"
								className={ `${ TEXTAREA_CLASSES } h-20` }
								placeholder={ __(
									'Eg: Buy more, save more! 1 item gets 10% off, 2 items get 20% off, and the savings grow with every item.',
									'power-coupons'
								) }
								defaultValue={
									formData.description ||
									presetData?.description ||
									''
								}
								onChange={ ( e ) =>
									setFormData( 'description', e.target.value )
								}
							/>
						</div>

						<div className="flex flex-col gap-1.5">
							{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
							<label className="text-sm font-medium text-text-primary">
								{ __( 'Activate Offer', 'power-coupons' ) }
							</label>
							<RadioButton.Group
								className="grid-cols-1 sm:grid-cols-2 [&_p.text-text-tertiary]:text-text-secondary"
								columns={ 2 }
								onChange={ ( value ) =>
									setFormData( 'activation_type', value )
								}
								size="md"
								defaultValue={
									formData.activation_type ||
									presetData?.activation_type ||
									'automatically'
								}
								style="simple"
							>
								<RadioButton.Button
									label={ {
										description: __(
											"Shows the offer name in the cart summary after it's applied.",
											'power-coupons'
										),
										heading: __(
											'Automatically',
											'power-coupons'
										),
									} }
									value="automatically"
									borderOn
								/>
								<RadioButton.Button
									label={ {
										description: __(
											'Apply this offer by entering the coupon code for eligible items.',
											'power-coupons'
										),
										heading: __(
											'Using Coupon Code',
											'power-coupons'
										),
									} }
									value="manually"
									borderOn
								/>
							</RadioButton.Group>
						</div>
					</div>

					<Button
						className={ PRIMARY_BUTTON_CLASSES }
						size="md"
						tag="button"
						type="button"
						variant="primary"
						onClick={ handleSaveAndContinue }
					>
						{ __( 'Save & Continue', 'power-coupons' ) }
					</Button>
				</>
			);
		},
	},
	{
		slug: 'offer-conditions',
		title: __( 'Offer Conditions', 'power-coupons' ),
		content: ( {
			formData,
			setFormData,
			setActiveTab,
			errors,
			setErrors,
			clearError,
		} ) => {
			const handleSaveAndContinue = () => {
				const tabErrors = validateTab2( formData );
				if ( Object.keys( tabErrors ).length > 0 ) {
					setErrors( tabErrors );
					return;
				}
				setErrors( {} );
				setActiveTab( FormTabs[ 2 ].slug );
			};

			return (
				<>
					<SectionIntro
						title={ __( 'Set Offer Conditions', 'power-coupons' ) }
						description={ __(
							'Configure when and how your BOGO offer should be applied.',
							'power-coupons'
						) }
					/>

					<div className="flex flex-col gap-4">
						{ /* Discount Type */ }
						<div className="flex flex-col gap-1.5">
							{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
							<label className="text-sm font-medium text-text-primary">
								{ __( 'Discount Type', 'power-coupons' ) }
							</label>
							<RadioButton.Group
								className="grid-cols-1 sm:grid-cols-3"
								columns={ 3 }
								onChange={ ( value ) => {
									setFormData( 'discount_type', value );
									clearError( 'discount_percent' );
									clearError( 'discount_amount' );
								} }
								size="md"
								style="simple"
							>
								<RadioButton.Button
									label={ {
										heading: __( 'Free', 'power-coupons' ),
									} }
									checked={
										! formData.discount_type ||
										formData.discount_type === 'free'
									}
									value="free"
									borderOn
								/>
								<RadioButton.Button
									label={ {
										heading: __(
											'Percentage',
											'power-coupons'
										),
									} }
									checked={
										formData.discount_type === 'percentage'
									}
									value="percentage"
									borderOn
								/>
								<RadioButton.Button
									label={ {
										heading: __(
											'Fixed Amount',
											'power-coupons'
										),
									} }
									checked={
										formData.discount_type === 'fixed'
									}
									value="fixed"
									borderOn
								/>
							</RadioButton.Group>
						</div>

						{ /* Quantity thresholds — the three Buy X types share one pair. */ }
						{ BUY_X_TYPES.includes( formData.key ) && (
							<>
								<NumberField
									id="bogo-input-buy-quantity"
									label={ __(
										'Buy Quantity',
										'power-coupons'
									) }
									min="1"
									defaultValue={
										formData.buy_quantity || '1'
									}
									error={ errors.buy_quantity }
									onChange={ ( value ) => {
										setFormData( 'buy_quantity', value );
										clearError( 'buy_quantity' );
									} }
								/>
								<NumberField
									id="bogo-input-get-quantity"
									label={ __(
										'Get Quantity',
										'power-coupons'
									) }
									min="1"
									defaultValue={
										formData.get_quantity || '1'
									}
									error={ errors.get_quantity }
									onChange={ ( value ) => {
										setFormData( 'get_quantity', value );
										clearError( 'get_quantity' );
									} }
								/>
							</>
						) }

						{ /* Spend threshold */ }
						{ SPEND_X_TYPES.includes( formData.key ) && (
							<>
								<NumberField
									id="bogo-input-spend-amount"
									label={ __(
										'Minimum Spend Amount',
										'power-coupons'
									) }
									min="0"
									step="0.01"
									defaultValue={
										formData.spend_amount || '50'
									}
									error={ errors.spend_amount }
									onChange={ ( value ) => {
										setFormData( 'spend_amount', value );
										clearError( 'spend_amount' );
									} }
								/>
								{ formData.key !==
									'spend-x-get-free-shipping' && (
									<NumberField
										id="bogo-input-spend-get-quantity"
										label={ __(
											'Get Quantity',
											'power-coupons'
										) }
										min="1"
										defaultValue={
											formData.get_quantity || '1'
										}
										error={ errors.get_quantity }
										onChange={ ( value ) => {
											setFormData(
												'get_quantity',
												value
											);
											clearError( 'get_quantity' );
										} }
									/>
								) }
							</>
						) }

						{ /* Discount percentage */ }
						{ formData.discount_type === 'percentage' && (
							<NumberField
								id="bogo-input-discount-percent"
								label={ __(
									'Discount Percentage (%)',
									'power-coupons'
								) }
								min="0"
								max="100"
								step="0.01"
								defaultValue={
									formData.discount_percent || '10'
								}
								error={ errors.discount_percent }
								onChange={ ( value ) => {
									setFormData( 'discount_percent', value );
									clearError( 'discount_percent' );
								} }
							/>
						) }

						{ /* Fixed discount amount */ }
						{ formData.discount_type === 'fixed' && (
							<NumberField
								id="bogo-input-discount-amount"
								label={ __(
									'Fixed Discount Amount',
									'power-coupons'
								) }
								min="0"
								step="0.01"
								defaultValue={ formData.discount_amount || '5' }
								error={ errors.discount_amount }
								onChange={ ( value ) => {
									setFormData( 'discount_amount', value );
									clearError( 'discount_amount' );
								} }
							/>
						) }

						{ /* Schedule — Start & End Dates */ }
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<DateField
								id="bogo-input-start-date"
								label={ __( 'Start Date', 'power-coupons' ) }
								value={ formData.start_date ?? '' }
								placeholder={ __(
									'Select start date',
									'power-coupons'
								) }
								onChange={ ( value ) =>
									setFormData( 'start_date', value )
								}
								helper={ __(
									'Leave blank to start immediately.',
									'power-coupons'
								) }
							/>
							<DateField
								id="bogo-input-end-date"
								label={ __( 'End Date', 'power-coupons' ) }
								value={ formData.end_date ?? '' }
								placeholder={ __(
									'Select end date',
									'power-coupons'
								) }
								onChange={ ( value ) =>
									setFormData( 'end_date', value )
								}
								helper={ __(
									'Leave blank to never expire.',
									'power-coupons'
								) }
							/>
						</div>

						{ /* Free Shipping Option */ }
						<div className="flex items-start flex-col gap-1.5">
							<Checkbox
								label={ {
									heading: __(
										'Include free shipping',
										'power-coupons'
									),
								} }
								size="sm"
								defaultChecked={
									formData.free_shipping || false
								}
								onChange={ ( checked ) =>
									setFormData( 'free_shipping', checked )
								}
							/>
						</div>
					</div>

					<div className="flex gap-2 ml-auto">
						<Button
							variant="outline"
							onClick={ () => {
								setErrors( {} );
								setActiveTab( FormTabs[ 0 ].slug );
							} }
						>
							{ __( 'Back', 'power-coupons' ) }
						</Button>
						<Button
							className={ PRIMARY_BUTTON_CLASSES }
							variant="primary"
							onClick={ handleSaveAndContinue }
						>
							{ __( 'Save & Continue', 'power-coupons' ) }
						</Button>
					</div>
				</>
			);
		},
	},
	{
		slug: 'product-selection',
		title: __( 'Product Selection', 'power-coupons' ),
		content: ( {
			formData,
			setFormData,
			setActiveTab,
			saveOffer,
			isLoading,
			saved,
			errors,
			setErrors,
			clearError,
			formError,
		} ) => {
			const isBuyXType = BUY_X_TYPES.includes( formData.key );
			const triggerType = formData.trigger_type || 'any_product';
			const showProductsToBuy =
				! isBuyXType || triggerType === 'specific_products';

			return (
				<>
					<SectionIntro
						title={ __( 'Select Products', 'power-coupons' ) }
						description={ __(
							'Choose which products are eligible for this BOGO offer.',
							'power-coupons'
						) }
					/>

					<div className="flex flex-col gap-4">
						{ isBuyXType && (
							<div className="flex flex-col gap-1.5">
								{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
								<label className="text-sm font-medium text-text-primary">
									{ __( 'Trigger Type', 'power-coupons' ) }
								</label>
								<RadioButton.Group
									className="grid-cols-1 sm:grid-cols-2 [&_p.text-text-tertiary]:text-text-secondary"
									columns={ 2 }
									onChange={ ( value ) => {
										setFormData( 'trigger_type', value );
										clearError( 'buy_product_ids' );
									} }
									defaultValue={ triggerType }
									size="md"
									style="simple"
								>
									<RadioButton.Button
										label={ {
											heading: __(
												'Any Product',
												'power-coupons'
											),
											description: __(
												'Trigger when cart contains any product.',
												'power-coupons'
											),
										} }
										value="any_product"
										checked={
											triggerType === 'any_product'
										}
										borderOn
									/>
									<RadioButton.Button
										label={ {
											heading: __(
												'Specific Products',
												'power-coupons'
											),
											description: __(
												'Trigger only for selected products.',
												'power-coupons'
											),
										} }
										value="specific_products"
										checked={
											triggerType === 'specific_products'
										}
										borderOn
									/>
								</RadioButton.Group>
							</div>
						) }

						{ showProductsToBuy && (
							<div className="flex flex-col gap-1">
								<ProductSelector
									inputId="bogo-buy-product-ids"
									label={ __(
										'Products to Buy',
										'power-coupons'
									) }
									placeholder={ __(
										'Search for products…',
										'power-coupons'
									) }
									value={ formData.buy_product_ids || [] }
									error={ !! errors.buy_product_ids }
									describedBy={
										errors.buy_product_ids
											? 'bogo-buy-product-ids-error'
											: undefined
									}
									onChange={ ( productIds ) => {
										setFormData(
											'buy_product_ids',
											productIds
										);
										clearError( 'buy_product_ids' );
									} }
								/>
								<FieldError
									id="bogo-buy-product-ids-error"
									message={ errors.buy_product_ids }
								/>
							</div>
						) }

						{ formData.key !== 'buy-x-get-x-free' &&
							formData.key !== 'spend-x-get-free-shipping' && (
								<div className="flex flex-col gap-1">
									<ProductSelector
										inputId="bogo-get-product-ids"
										label={ __(
											'Products to Get',
											'power-coupons'
										) }
										placeholder={ __(
											'Search for products…',
											'power-coupons'
										) }
										value={ formData.get_product_ids || [] }
										error={ !! errors.get_product_ids }
										describedBy={
											errors.get_product_ids
												? 'bogo-get-product-ids-error'
												: undefined
										}
										onChange={ ( productIds ) => {
											setFormData(
												'get_product_ids',
												productIds
											);
											clearError( 'get_product_ids' );
										} }
									/>
									<FieldError
										id="bogo-get-product-ids-error"
										message={ errors.get_product_ids }
									/>
								</div>
							) }

						<Input
							id="bogo-input-usage-limit"
							size="md"
							label={ __(
								'Usage Limit (Optional)',
								'power-coupons'
							) }
							type="number"
							min="0"
							placeholder={ __(
								'Leave empty for unlimited usage',
								'power-coupons'
							) }
							onChange={ ( value ) =>
								setFormData( 'usage_limit', value )
							}
						/>
					</div>

					{ /* Server-level error banner */ }
					<FormErrorBanner message={ formError } />

					<div className="flex gap-2 ml-auto">
						<Button
							variant="outline"
							disabled={ saved }
							onClick={ () => {
								setErrors( {} );
								setActiveTab( FormTabs[ 1 ].slug );
							} }
						>
							{ __( 'Back', 'power-coupons' ) }
						</Button>
						{ SPEND_X_TYPES.includes( formData.key ) ? (
							<Button
								className={ PRIMARY_BUTTON_CLASSES }
								variant="primary"
								onClick={ () => {
									const tab3Errors = validateTab3( formData );
									if (
										Object.keys( tab3Errors ).length > 0
									) {
										setErrors( tab3Errors );
										return;
									}
									setErrors( {} );
									setActiveTab( FormTabs[ 3 ].slug );
								} }
							>
								{ __( 'Save & Continue', 'power-coupons' ) }
							</Button>
						) : (
							<Button
								className={ PRIMARY_BUTTON_CLASSES }
								variant="primary"
								onClick={ () => {
									const tab3Errors = validateTab3( formData );
									if (
										Object.keys( tab3Errors ).length > 0
									) {
										setErrors( tab3Errors );
										return;
									}
									setErrors( {} );
									saveOffer();
								} }
								disabled={ isLoading || saved }
							>
								{ /* eslint-disable no-nested-ternary */ }
								{ isLoading
									? formData.id
										? __( 'Updating…', 'power-coupons' )
										: __( 'Creating…', 'power-coupons' )
									: formData.id
									? __( 'Update Offer', 'power-coupons' )
									: __( 'Create Offer', 'power-coupons' ) }
								{ /* eslint-enable no-nested-ternary */ }
							</Button>
						) }
					</div>
				</>
			);
		},
	},
	{
		slug: 'progress-bar',
		title: __( 'Progress Bar', 'power-coupons' ),
		content: ( {
			formData,
			setFormData,
			setActiveTab,
			saveOffer,
			isLoading,
			saved,
			formError,
		} ) => {
			const isSpendType = SPEND_X_TYPES.includes( formData.key );

			return (
				<>
					<SectionIntro
						title={ __( 'Cart Progress Bar', 'power-coupons' ) }
						description={ __(
							'Configure how this offer appears in the cart progress bar. Only applies to spend-based offers.',
							'power-coupons'
						) }
					/>

					{ ! isSpendType && (
						<p className="text-sm leading-6 text-text-secondary bg-field-primary-background border border-solid border-border-subtle rounded-md px-4 py-3">
							{ __(
								'Progress bar is only available for spend-based offers (Spend $X types). Quantity-based offers do not have a spend threshold.',
								'power-coupons'
							) }
						</p>
					) }

					{ isSpendType && (
						<div className="flex flex-col gap-4">
							<div className="flex items-center gap-3">
								<Switch
									size="sm"
									className="[&>input]:!border-none"
									defaultValue={
										formData.progress_bar_enabled || false
									}
									onChange={ ( checked ) =>
										setFormData(
											'progress_bar_enabled',
											checked
										)
									}
								/>
								<span className="text-sm font-medium text-text-primary">
									{ __(
										'Enable Progress Bar',
										'power-coupons'
									) }
								</span>
							</div>

							<div>
								{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
								<label className="block text-sm font-medium text-text-primary mb-1">
									{ __( 'Icon', 'power-coupons' ) }
								</label>
								<Select
									size="md"
									value={
										formData.progress_bar_icon || 'gift'
									}
									onChange={ ( value ) =>
										setFormData(
											'progress_bar_icon',
											value
										)
									}
								>
									{ /* The settings app is wrapped in a form,
									so an untyped button would submit it. */ }
									<Select.Button
										type="button"
										className="w-full"
										aria-label={ __(
											'Icon',
											'power-coupons'
										) }
										render={ ( value ) =>
											PROGRESS_BAR_ICONS.find(
												( icon ) => icon.value === value
											)?.label
										}
									/>
									<Select.Options>
										{ PROGRESS_BAR_ICONS.map( ( icon ) => (
											<Select.Option
												key={ icon.value }
												value={ icon.value }
											>
												{ icon.label }
											</Select.Option>
										) ) }
									</Select.Options>
								</Select>
							</div>

							<NumberField
								id="bogo-progress-bar-priority"
								label={ __( 'Priority', 'power-coupons' ) }
								min="1"
								step="1"
								defaultValue={
									formData.progress_bar_priority || '1'
								}
								onChange={ ( value ) =>
									setFormData(
										'progress_bar_priority',
										value
									)
								}
							/>

							<div>
								<label
									htmlFor="bogo-progress-bar-message"
									className="block text-sm font-medium text-text-primary mb-1"
								>
									{ __(
										'Progress Message',
										'power-coupons'
									) }
								</label>
								<textarea
									id="bogo-progress-bar-message"
									className={ TEXTAREA_CLASSES }
									rows="2"
									defaultValue={
										formData.progress_bar_message ||
										__(
											'Spend {remaining} more to unlock {coupon_name}!',
											'power-coupons'
										)
									}
									onChange={ ( e ) =>
										setFormData(
											'progress_bar_message',
											e.target.value
										)
									}
								/>
								<p className="mt-1 text-xs text-text-secondary">
									{ __(
										'Placeholders: {remaining}, {threshold}, {coupon_name}',
										'power-coupons'
									) }
								</p>
							</div>

							<div>
								<label
									htmlFor="bogo-progress-bar-success-msg"
									className="block text-sm font-medium text-text-primary mb-1"
								>
									{ __( 'Success Message', 'power-coupons' ) }
								</label>
								<textarea
									id="bogo-progress-bar-success-msg"
									className={ TEXTAREA_CLASSES }
									rows="2"
									defaultValue={
										formData.progress_bar_success_msg ||
										__(
											'You unlocked {coupon_name}!',
											'power-coupons'
										)
									}
									onChange={ ( e ) =>
										setFormData(
											'progress_bar_success_msg',
											e.target.value
										)
									}
								/>
							</div>
						</div>
					) }

					{ /* Server-level error banner */ }
					<FormErrorBanner message={ formError } />

					<div className="flex gap-2 ml-auto">
						<Button
							variant="outline"
							disabled={ saved }
							onClick={ () => setActiveTab( FormTabs[ 2 ].slug ) }
						>
							{ __( 'Back', 'power-coupons' ) }
						</Button>
						<Button
							className={ PRIMARY_BUTTON_CLASSES }
							variant="primary"
							onClick={ saveOffer }
							disabled={ isLoading || saved }
						>
							{ /* eslint-disable no-nested-ternary */ }
							{ isLoading
								? formData.id
									? __( 'Updating…', 'power-coupons' )
									: __( 'Creating…', 'power-coupons' )
								: formData.id
								? __( 'Update Offer', 'power-coupons' )
								: __( 'Create Offer', 'power-coupons' ) }
							{ /* eslint-enable no-nested-ternary */ }
						</Button>
					</div>
				</>
			);
		},
	},
];

// ─── Preset grid screen ───────────────────────────────────────────────────────

const _ModalContentOffersPresetGrid = ( { onSelect } ) => {
	const handleClick = ( preset ) => onSelect( preset );

	return (
		<div className="flex flex-col gap-6 sm:gap-8 px-3 text-left">
			<h3 className="text-text-primary text-xl sm:text-2xl font-semibold m-0">
				{ __( 'Select the offer you want to create', 'power-coupons' ) }
			</h3>
			{ /* Tiles are left-aligned and sized by their content: centred text
			     over a fixed 152px box left every tile ragged with a band of
			     dead space under the two-line descriptions. */ }
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(3,292px)] gap-4">
				{ BOGOPresets.map( ( preset ) => (
					<button
						key={ preset.key }
						type="button"
						onClick={ () => handleClick( preset ) }
						className="text-left cursor-pointer w-full h-auto min-h-[104px] border-solid border border-border-subtle bg-white rounded-lg p-4 shadow-[0px_1px_2px_0px_#0000000D] transition-[outline-color,box-shadow] duration-200 outline outline-2 outline-offset-0 outline-transparent hover:outline-wpcolor hover:shadow-[0px_2px_6px_0px_#0000001A] focus-visible:outline-wpcolor focus-visible:outline-offset-2"
					>
						<h4 className="m-0 font-semibold text-lg leading-7 text-text-primary">
							{ preset.title }
						</h4>
						<p className="m-0 mt-1 text-text-secondary text-sm leading-6">
							{ preset.description }
						</p>
					</button>
				) ) }
			</div>
		</div>
	);
};

// ─── Form screen ──────────────────────────────────────────────────────────────

/**
 * Where a step sits relative to the one being edited.
 *
 * @param {number} activeIndex Index of the step currently open.
 * @param {number} index       Index of the step being drawn.
 * @return {string} 'done', 'current' or 'upcoming'.
 */
const stepState = ( activeIndex, index ) => {
	if ( activeIndex > index ) {
		return 'done';
	}
	return activeIndex === index ? 'current' : 'upcoming';
};

/**
 * Circle at the head of a step: its position until the step is finished, then
 * a check.
 *
 * @param {Object}  props
 * @param {string}  props.state     One of 'done', 'current' or 'upcoming'.
 * @param {number}  props.number    1-based position of the step.
 * @param {boolean} props.celebrate Play the check's entrance, for the step that
 *                                  completes when the offer saves.
 */
const StepMarker = ( { state, number, celebrate = false } ) => {
	// box-border: preflight is off here, so a bordered circle would otherwise
	// measure 31px against its 28px siblings.
	const shape =
		'flex items-center justify-center shrink-0 box-border size-7 rounded-full text-xs font-bold';

	if ( 'done' === state ) {
		return (
			<span
				className={ `${ shape } bg-background-primary border-[1.5px] border-solid border-wpcolor text-wpcolor transition-colors duration-300` }
			>
				<CheckIcon
					aria-hidden="true"
					className={ `size-3.5${
						celebrate
							? ' animate-check-pop motion-reduce:animate-none'
							: ''
					}` }
					strokeWidth={ 3 }
				/>
			</span>
		);
	}

	// Upcoming steps take text-secondary, not the disabled-button text token:
	// that pair is 2.3:1, and this is a 12px digit.
	return (
		<span
			className={ `${ shape } ${
				'current' === state
					? 'bg-wpcolor text-text-on-color'
					: 'bg-button-disabled text-text-secondary'
			}` }
		>
			{ number }
		</span>
	);
};

/**
 * Type treatment for a step's name.
 *
 * @param {string} state One of 'done', 'current' or 'upcoming'.
 * @return {string} Tailwind classes.
 */
const stepLabelClasses = ( state ) => {
	if ( 'current' === state ) {
		return 'font-bold text-text-primary';
	}
	return 'done' === state
		? 'font-semibold text-text-primary'
		: 'font-semibold text-text-secondary';
};

const _ModalContentForm = ( {
	setCurrentScreen,
	formData,
	setFormData,
	toggleModalOpen,
	saved,
	onSaved,
} ) => {
	const [ activeTab, setActiveTabInternal ] = useState( FormTabs[ 0 ].slug );
	const [ isLoading, setIsLoading ] = useState( false );
	const closeTimer = useRef( null );

	// The topbar's close button can unmount this while the hold is running.
	useEffect( () => () => clearTimeout( closeTimer.current ), [] );
	const [ errors, setErrors ] = useState( {} );
	const [ formError, setFormError ] = useState( '' );

	const isSpendType = SPEND_X_TYPES.includes( formData.key );
	const visibleTabs = isSpendType
		? FormTabs
		: FormTabs.filter( ( tab ) => tab.slug !== 'progress-bar' );
	const tabIndex = visibleTabs.findIndex( ( t ) => t.slug === activeTab );
	const presetData = getBOGOPresetData( formData.key );

	/**
	 * Navigate to a tab — always clears all errors first so stale messages
	 * from a previous tab don't bleed through.
	 * @param {string} slug
	 */
	const setActiveTab = ( slug ) => {
		setErrors( {} );
		setFormError( '' );
		setActiveTabInternal( slug );
	};

	/**
	 * Remove a single field's error — called from each field's onChange handler
	 * so the error disappears the moment the admin starts correcting the value.
	 * @param {string} key
	 */
	const clearError = ( key ) => {
		setErrors( ( prev ) => {
			if ( ! prev[ key ] ) {
				return prev;
			}
			const next = { ...prev };
			delete next[ key ];
			return next;
		} );
	};

	/**
	 * Final submit — called by the last tab's "Create / Update Offer" button.
	 * POSTs to the server with all form data including progress bar fields.
	 * Server validation errors are mapped back to the relevant tab.
	 */
	const saveOffer = async () => {
		setIsLoading( true );
		setFormError( '' );
		setErrors( {} );

		try {
			const payload = new FormData();
			payload.append( 'action', 'power_coupons_save_bogo_offer' );
			payload.append(
				'_wpnonce',
				window.powerCouponsSettings?.update_nonce || ''
			);

			if ( formData.id ) {
				payload.append( 'offer_id', formData.id );
			}

			payload.append( 'name', formData.name || presetData?.title || '' );
			payload.append(
				'description',
				formData.description || presetData?.description || ''
			);
			payload.append( 'offer_type', formData.key || 'buy-x-get-x-free' );
			payload.append(
				'activation_type',
				formData.activation_type || 'automatically'
			);
			payload.append( 'buy_quantity', formData.buy_quantity ?? 1 );
			payload.append( 'get_quantity', formData.get_quantity ?? 1 );
			payload.append( 'spend_amount', formData.spend_amount ?? 50 );
			payload.append( 'discount_type', formData.discount_type || 'free' );
			payload.append(
				'discount_percent',
				formData.discount_percent ?? 10
			);
			payload.append( 'discount_amount', formData.discount_amount ?? 5 );
			payload.append( 'free_shipping', formData.free_shipping || false );
			payload.append(
				'trigger_type',
				formData.trigger_type || 'any_product'
			);

			// Schedule fields.
			payload.append( 'start_date', formData.start_date || '' );
			payload.append( 'end_date', formData.end_date || '' );

			( formData.buy_product_ids || [] ).forEach( ( id, i ) =>
				payload.append( `buy_product_ids[${ i }]`, id )
			);
			( formData.get_product_ids || [] ).forEach( ( id, i ) =>
				payload.append( `get_product_ids[${ i }]`, id )
			);

			// Progress bar fields.
			payload.append(
				'progress_bar_enabled',
				formData.progress_bar_enabled || false
			);
			payload.append(
				'progress_bar_icon',
				formData.progress_bar_icon || 'gift'
			);
			payload.append(
				'progress_bar_priority',
				formData.progress_bar_priority ?? 1
			);
			payload.append(
				'progress_bar_message',
				formData.progress_bar_message || ''
			);
			payload.append(
				'progress_bar_success_msg',
				formData.progress_bar_success_msg || ''
			);

			const response = await fetch( ajaxurl, {
				method: 'POST',
				body: payload,
			} );
			const result = await response.json();

			if ( result.success ) {
				// Closing here dropped the modal the instant the request
				// returned, so a save read as the dialog vanishing. Mark the
				// last step done, let the check land, then close.
				onSaved();
				// No form reset here: the modal unmounts on close and its
				// state goes with it.
				closeTimer.current = setTimeout( () => {
					toggleModalOpen( true );
				}, SUCCESS_HOLD_MS );
			} else if (
				result.data?.type === 'validation' &&
				result.data?.errors
			) {
				// Structured server-side validation errors.
				const serverErrors = result.data.errors;
				setErrors( serverErrors );

				// Navigate back to the tab that owns the first error.
				if ( serverErrors.name ) {
					setActiveTabInternal( FormTabs[ 0 ].slug );
				} else if (
					serverErrors.buy_quantity ||
					serverErrors.get_quantity ||
					serverErrors.spend_amount ||
					serverErrors.discount_percent ||
					serverErrors.discount_amount
				) {
					setActiveTabInternal( FormTabs[ 1 ].slug );
				}
				// Product / Tab 3 errors stay on the current tab.
			} else {
				const msg =
					typeof result.data === 'string'
						? result.data
						: __(
								'Failed to save offer. Please try again.',
								'power-coupons'
						  );
				setFormError( msg );
			}
		} catch ( error ) {
			console.error( 'Error saving offer:', error );
			setFormError(
				__(
					'An error occurred while saving the offer. Please try again.',
					'power-coupons'
				)
			);
		} finally {
			setIsLoading( false );
		}
	};

	return (
		<div className="bg-white w-full max-w-[760px] rounded-md px-4 sm:px-6 py-6 sm:py-8 shadow-[0px_1px_2px_-1px_#0000001A,0px_1px_3px_0px_#0000001A]">
			{ /* Form Header */ }
			<div className="flex items-center gap-2">
				{ ! formData.id && (
					<button
						type="button"
						aria-label={ __(
							'Back to offer types',
							'power-coupons'
						) }
						// Off during the hold like Back and Submit: leaving the
						// form then would cancel the close and keep the saved
						// offer's values for the next one.
						disabled={ saved }
						className="flex items-center justify-center shrink-0 -ml-1.5 size-8 rounded-md m-0 p-0 bg-transparent border-none cursor-pointer leading-[0] text-icon-secondary transition-colors duration-200 hover:bg-misc-dropdown-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wpcolor disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
						onClick={ () => setCurrentScreen( 'offers' ) }
					>
						{ RenderIcon( 'chevronLeft' ) }
					</button>
				) }
				<h3 className="m-0 text-xl sm:text-2xl font-semibold text-text-primary">
					{ formData.id
						? __( 'Edit Offer', 'power-coupons' ) +
						  ': ' +
						  ( formData.name || presetData?.title )
						: formData?.name ||
						  presetData?.title ||
						  __( 'Create a New Offer', 'power-coupons' ) }
				</h3>
			</div>

			{ /* Form body */ }
			<div className="mt-6">
				<Tabs activeItem={ activeTab }>
					{ /* Numbered circles and connectors, not an underlined tab
					     strip: the steps only report progress, and the strip
					     read as four tabs that ignored every click. Back and
					     Save & Continue still do all the moving. */ }
					<div className="flex items-center pb-[18px] border-0 border-b border-solid border-border-subtle">
						<ol
							aria-label={ __(
								'Offer setup steps',
								'power-coupons'
							) }
							className="power-coupons-bogo-steps flex flex-wrap items-center gap-x-5 gap-y-3 lg:gap-x-0 list-none m-0 p-0 min-w-0 flex-1"
						>
							{ visibleTabs.map( ( tab, index ) => {
								const state = saved
									? 'done'
									: stepState( tabIndex, index );
								return (
									<Fragment key={ tab.slug }>
										{ index > 0 && (
											// Flexible rather than the comp's fixed
											// 32px: four steps plus the counter
											// overflow the panel at that width and
											// push the counter onto its own row.
											<li
												aria-hidden="true"
												className={ `hidden lg:block h-0.5 mx-3 flex-1 min-w-3 max-w-8 rounded-sm ${
													'upcoming' === state
														? 'bg-border-subtle'
														: 'bg-wpcolor'
												}` }
											/>
										) }
										<li
											className="flex items-center gap-2.5 shrink-0"
											aria-current={
												'current' === state
													? 'step'
													: undefined
											}
										>
											<StepMarker
												state={ state }
												number={ index + 1 }
												celebrate={
													saved && index === tabIndex
												}
											/>
											<span
												className={ `text-sm whitespace-nowrap ${ stepLabelClasses(
													state
												) }` }
											>
												{ tab.title }
											</span>
										</li>
									</Fragment>
								);
							} ) }
						</ol>
						{ /* Not a step, so not in the list: the list should
						     count only steps. */ }
						<span className="ml-auto pl-6 shrink-0 text-xs font-semibold text-text-secondary whitespace-nowrap">
							{ sprintf(
								/* translators: 1: current step number. 2: total number of steps. */
								__( 'Step %1$d of %2$d', 'power-coupons' ),
								tabIndex + 1,
								visibleTabs.length
							) }
						</span>
					</div>
					<SaveStatus
						announce={ saved }
						message={
							formData.id
								? __( 'Offer updated.', 'power-coupons' )
								: __( 'Offer created.', 'power-coupons' )
						}
					/>

					<div className="py-5 flex flex-col text-left gap-6">
						{ visibleTabs.map( ( tab ) => (
							<Tabs.Panel key={ tab.slug } slug={ tab.slug }>
								{
									<tab.content
										formData={ formData }
										setFormData={ setFormData }
										presetData={ presetData }
										setActiveTab={ setActiveTab }
										saveOffer={ saveOffer }
										isLoading={ isLoading }
										saved={ saved }
										errors={ errors }
										setErrors={ setErrors }
										clearError={ clearError }
										formError={ formError }
									/>
								}
							</Tabs.Panel>
						) ) }
					</div>
				</Tabs>
			</div>
		</div>
	);
};

// ─── Modal root ───────────────────────────────────────────────────────────────

const ModalContent = ( { toggleModalOpen, editingOffer, saved, onSaved } ) => {
	const [ currentScreen, setCurrentScreen ] = useState(
		editingOffer ? 'form' : 'offers'
	);
	const [ formData, setFormData ] = useState(
		editingOffer
			? {
					id: editingOffer.id,
					key: editingOffer.offer_type,
					name: editingOffer.name,
					description: editingOffer.description,
					activation_type:
						editingOffer.activation_type || 'automatically',
					buy_quantity: editingOffer.buy_quantity || 1,
					get_quantity: editingOffer.get_quantity || 1,
					spend_amount: editingOffer.spend_amount || 50,
					discount_type: editingOffer.discount_type || 'free',
					discount_percent: editingOffer.discount_percent || 10,
					discount_amount: editingOffer.discount_amount || 0,
					free_shipping: editingOffer.free_shipping || false,
					buy_product_ids: editingOffer.buy_product_ids || [],
					get_product_ids: editingOffer.get_product_ids || [],
					trigger_type: editingOffer.trigger_type || 'any_product',
					start_date: editingOffer.start_date || '',
					end_date: editingOffer.end_date || '',
					progress_bar_enabled:
						editingOffer.progress_bar_enabled || false,
					progress_bar_icon: editingOffer.progress_bar_icon || 'gift',
					progress_bar_priority:
						editingOffer.progress_bar_priority || 1,
					progress_bar_message:
						editingOffer.progress_bar_message || '',
					progress_bar_success_msg:
						editingOffer.progress_bar_success_msg || '',
			  }
			: {}
	);

	const handleFormData = ( key, value ) => {
		setFormData( ( prev ) => ( { ...prev, [ key ]: value } ) );
	};

	// Replace, not merge: anything left over from an earlier pass through the
	// form would otherwise pre-fill the next offer.
	const startOffer = ( preset ) => {
		setFormData( { key: preset.key, name: preset.title } );
		setCurrentScreen( 'form' );
	};

	// Top-aligned: the topbar is 56px tall and fixed, so the panel starts clear
	// of it instead of floating in the middle of a tall viewport.
	return (
		<div className="flex items-start justify-center text-center px-4 sm:px-6 lg:px-0 pt-[88px] pb-12 min-h-full box-border">
			{ 'offers' === currentScreen ? (
				<_ModalContentOffersPresetGrid onSelect={ startOffer } />
			) : (
				<_ModalContentForm
					toggleModalOpen={ toggleModalOpen }
					setCurrentScreen={ setCurrentScreen }
					formData={ formData }
					setFormData={ handleFormData }
					saved={ saved }
					onSaved={ onSaved }
				/>
			) }
		</div>
	);
};

export default ( { toggleModalOpen, editingOffer } ) => {
	// Set once the offer has saved and the wizard is holding its last step on
	// screen before closing itself. Owned here so the topbar's close button and
	// Escape close with the same confirmation the timer would have given,
	// instead of reading as a cancel.
	const [ saved, setSaved ] = useState( false );
	const close = () => toggleModalOpen( saved );

	// The offers list stays mounted underneath this overlay, so without a
	// trap one Tab press walks out of the dialog into controls it is covering.
	const dialogRef = useRef( null );
	useModalFocus( dialogRef, { onEscape: close } );

	return (
		<div
			ref={ dialogRef }
			tabIndex={ -1 }
			id="power-coupons-bogo-modal"
			role="dialog"
			aria-modal="true"
			aria-label={
				editingOffer
					? __( 'Edit BOGO offer', 'power-coupons' )
					: __( 'Create a BOGO offer', 'power-coupons' )
			}
			// fixed, not absolute: nothing locks the page behind, so an
			// absolutely-placed overlay scrolls away and reveals the offers
			// list under it once that page is taller than the viewport.
			// overscroll-contain stops the same page scrolling once this one
			// bottoms out.
			className="bg-field-primary-background fixed inset-0 z-[999] overflow-y-auto overscroll-contain focus:outline-none"
		>
			<Topbar
				className="power_coupons-header--content !fixed h-14 min-h-[unset] p-0 border-0 border-b border-solid border-border-subtle bg-white items-center z-10 shadow-[0px_1px_2px_0px_#0000000D]"
				gap={ 0 }
				role="navigation"
				aria-label={ __( 'Main Navigation', 'power-coupons' ) }
			>
				<Topbar.Left className="power_coupons-header--content-left lg:px-5 px-3">
					<Topbar.Item>
						<img
							className="lg:block h-8 w-8"
							src={ Logo }
							alt={ __( 'Power Coupons', 'power-coupons' ) }
						/>
					</Topbar.Item>
				</Topbar.Left>
				<Topbar.Right
					className="power_coupons-header--content-right p-2 md:p-4 gap-2 md:gap-4"
					gap="md"
				>
					<Topbar.Item>
						<button
							type="button"
							onClick={ close }
							aria-label={ __( 'Close', 'power-coupons' ) }
							className="flex items-center justify-center size-9 rounded-md bg-transparent border-none cursor-pointer text-icon-secondary transition-colors duration-200 hover:bg-misc-dropdown-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wpcolor"
						>
							{ RenderIcon( 'close' ) }
						</button>
					</Topbar.Item>
				</Topbar.Right>
			</Topbar>

			<ModalContent
				toggleModalOpen={ toggleModalOpen }
				editingOffer={ editingOffer }
				saved={ saved }
				onSaved={ () => setSaved( true ) }
			/>
		</div>
	);
};
