import {
	Button,
	Topbar,
	Tabs,
	Input,
	DatePicker,
	Switch,
	RadioButton,
} from '@bsf/force-ui';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useEffect, useRef, Fragment } from '@wordpress/element';
import Logo from '../../../../images/logo.svg';
import { RenderIcon } from '../common/Utils';
import FieldError from '../common/FieldError';
import SaveStatus from '../common/SaveStatus';
import useModalFocus from '../common/hooks/useModalFocus';
import { CalendarIcon, CheckIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

// How long the finished wizard stays on screen after a successful save, so the
// check on the last step is seen before the modal closes itself.
const SUCCESS_HOLD_MS = 1600;

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

// ─── Date helpers ─────────────────────────────────────────────────────────────

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

// ─── DateField component ──────────────────────────────────────────────────────

const DateField = ( { id, label, value, placeholder, onChange, helper } ) => {
	const [ open, setOpen ] = useState( false );
	const [ dropUp, setDropUp ] = useState( false );
	const ref = useRef( null );

	useEffect( () => {
		if ( ! open ) {
			return;
		}
		const handler = ( e ) => {
			if ( ref.current && ! ref.current.contains( e.target ) ) {
				setOpen( false );
			}
		};
		document.addEventListener( 'mousedown', handler );
		return () => document.removeEventListener( 'mousedown', handler );
	}, [ open ] );

	const handleToggle = () => {
		if ( ! open && ref.current ) {
			const rect = ref.current.getBoundingClientRect();
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
			ref.current?.querySelector( 'button' )?.focus();
		}
	};

	return (
		<div
			className="flex flex-col gap-1.5"
			ref={ ref }
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
			<HelperText>{ helper }</HelperText>
		</div>
	);
};

// ─── Select options ──────────────────────────────────────────────────────────

const ACTION_TYPE_OPTIONS = [
	{
		value: 'order_earn',
		label: __( 'Order Earning', 'power-coupons' ),
		description: __(
			'Award credits when a customer completes an order.',
			'power-coupons'
		),
	},
	{
		value: 'signup',
		label: __( 'Signup Bonus', 'power-coupons' ),
		description: __(
			'Award credits once when a new user registers an account.',
			'power-coupons'
		),
	},
	{
		value: 'review',
		label: __( 'Product Review', 'power-coupons' ),
		description: __(
			'Award credits when a customer leaves an approved product review.',
			'power-coupons'
		),
	},
];

const EARN_TYPE_OPTIONS = [
	{
		value: 'fixed',
		label: __( 'Fixed', 'power-coupons' ),
		description: __(
			'A fixed number of credits per order, regardless of total.',
			'power-coupons'
		),
	},
	{
		value: 'per_currency',
		label: __( 'Per Currency Unit', 'power-coupons' ),
		description: __(
			'Credits based on amount spent. E.g. 2 = 2 credits per $1.',
			'power-coupons'
		),
	},
	{
		value: 'percentage',
		label: __( 'Percentage', 'power-coupons' ),
		description: __(
			'Credits as a % of order total. E.g. 10 = 10% as credits.',
			'power-coupons'
		),
	},
];

// ─── Helper text, error and field components ─────────────────────────────────

const HelperText = ( { children } ) => {
	if ( ! children ) {
		return null;
	}
	return (
		<p className="m-0 text-xs text-text-secondary leading-snug">
			{ children }
		</p>
	);
};

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
 * Numeric field with its hint and its validation message.
 *
 * Four copies of label-plus-input-plus-hint stood here, none of them naming the
 * field its message belonged to.
 *
 * @param {Object} props
 * @param {string} props.id     Field id; the message id is derived from it.
 * @param {string} props.error  Validation message, empty when valid.
 * @param {string} props.helper One line on what the value does.
 */
const NumberField = ( { id, error, helper, ...inputProps } ) => {
	const errorId = `${ id }-error`;
	return (
		<div className="flex flex-col gap-1">
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
			<HelperText>{ helper }</HelperText>
		</div>
	);
};

// ─── Validation ──────────────────────────────────────────────────────────────

const validateStep1 = ( formData ) => {
	const errors = {};
	if ( ! ( formData.title || '' ).trim() ) {
		errors.title = __( 'Campaign name is required.', 'power-coupons' );
	}
	return errors;
};

const validateStep2 = ( formData ) => {
	const errors = {};
	if ( ! formData.earn_value || parseFloat( formData.earn_value ) <= 0 ) {
		errors.earn_value = __(
			'Earn value must be greater than 0.',
			'power-coupons'
		);
	}
	return errors;
};

// ─── Tab definitions ─────────────────────────────────────────────────────────

const FormTabs = [
	{
		slug: 'basic-settings',
		title: __( 'Basic Settings', 'power-coupons' ),
		content: ( {
			formData,
			setFormData,
			setActiveTab,
			errors,
			setErrors,
			clearError,
		} ) => {
			const handleSaveAndContinue = () => {
				const tabErrors = validateStep1( formData );
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
						title={ __( 'Campaign Basics', 'power-coupons' ) }
						description={ __(
							'Define the name, type, and earning rules for this campaign.',
							'power-coupons'
						) }
					/>

					<div className="flex flex-col gap-4">
						{ /* Campaign Name — required */ }
						<div className="flex flex-col gap-1">
							<Input
								value={ formData.title ?? '' }
								id="campaign-input-title"
								label={ __( 'Campaign Name', 'power-coupons' ) }
								size="md"
								type="text"
								error={ !! errors.title }
								{ ...( errors.title && {
									'aria-invalid': 'true',
									'aria-describedby':
										'campaign-input-title-error',
								} ) }
								placeholder={ __(
									'E.g. Order Credits: 1 per $1',
									'power-coupons'
								) }
								onChange={ ( value ) => {
									setFormData( 'title', value );
									clearError( 'title' );
								} }
							/>
							<FieldError
								id="campaign-input-title-error"
								message={ errors.title }
							/>
						</div>

						{ /* Description */ }
						<div className="flex flex-col items-start gap-1.5">
							<label
								htmlFor="campaign-textarea-description"
								className="text-sm font-medium text-text-primary"
							>
								{ __( 'Description', 'power-coupons' ) }
							</label>
							<textarea
								id="campaign-textarea-description"
								className={ `${ TEXTAREA_CLASSES } h-20` }
								placeholder={ __(
									'Optional description for this campaign',
									'power-coupons'
								) }
								defaultValue={ formData.description || '' }
								onChange={ ( e ) =>
									setFormData( 'description', e.target.value )
								}
							/>
						</div>

						{ /* Action Type */ }
						<div className="flex flex-col gap-1.5">
							<span className="text-sm font-medium text-text-primary">
								{ __( 'Action Type', 'power-coupons' ) }
							</span>
							<RadioButton.Group
								className="grid-cols-1 sm:grid-cols-3 [&_p.text-text-tertiary]:text-text-secondary"
								columns={ 3 }
								onChange={ ( value ) =>
									setFormData( 'action_type', value )
								}
								size="md"
								defaultValue={
									formData.action_type || 'order_earn'
								}
								style="simple"
							>
								{ ACTION_TYPE_OPTIONS.map( ( opt ) => (
									<RadioButton.Button
										key={ opt.value }
										label={ {
											heading: opt.label,
											description: opt.description,
										} }
										value={ opt.value }
										borderOn
									/>
								) ) }
							</RadioButton.Group>
						</div>
					</div>

					{ /* Save & Continue button */ }
					<div className="flex justify-end">
						<Button
							variant="primary"
							size="md"
							tag="button"
							type="button"
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
		slug: 'earning-rules',
		title: __( 'Earning Rules', 'power-coupons' ),
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
			const isOrderEarn = formData.action_type === 'order_earn';

			const getEarnValueLabel = () => {
				if ( ! isOrderEarn ) {
					return __( 'Credits to Award', 'power-coupons' );
				}
				return __( 'Earn Value', 'power-coupons' );
			};

			const getEarnValueHint = () => {
				if ( ! isOrderEarn ) {
					return __(
						'Fixed number of credits awarded each time this action occurs.',
						'power-coupons'
					);
				}
				switch ( formData.earn_type ) {
					case 'per_currency':
						return __(
							'E.g. "2" means 2 credits for every $1 spent.',
							'power-coupons'
						);
					case 'percentage':
						return __(
							'E.g. "10" means 10% of the order total as credits.',
							'power-coupons'
						);
					default:
						return __(
							'A fixed number of credits awarded per order, regardless of total.',
							'power-coupons'
						);
				}
			};

			const handleCreate = () => {
				const tabErrors = validateStep2( formData );
				if ( Object.keys( tabErrors ).length > 0 ) {
					setErrors( tabErrors );
					return;
				}
				setErrors( {} );
				saveOffer();
			};

			return (
				<>
					<SectionIntro
						title={ __( 'Earning Configuration', 'power-coupons' ) }
						description={ __(
							'Set the credits value, limits, and schedule for this campaign.',
							'power-coupons'
						) }
					/>

					<div className="flex flex-col gap-4">
						{ /* Row 1: Earn Type radio buttons (order_earn only) */ }
						{ isOrderEarn && (
							<div className="flex flex-col gap-1.5">
								<span className="text-sm font-medium text-text-primary">
									{ __( 'Earn Type', 'power-coupons' ) }
								</span>
								<RadioButton.Group
									className="grid-cols-1 sm:grid-cols-3 [&_p.text-text-tertiary]:text-text-secondary"
									columns={ 3 }
									onChange={ ( value ) =>
										setFormData( 'earn_type', value )
									}
									size="md"
									defaultValue={
										formData.earn_type || 'fixed'
									}
									style="simple"
								>
									{ EARN_TYPE_OPTIONS.map( ( opt ) => (
										<RadioButton.Button
											key={ opt.value }
											label={ {
												heading: opt.label,
												description: opt.description,
											} }
											value={ opt.value }
											borderOn
										/>
									) ) }
								</RadioButton.Group>
							</div>
						) }

						{ /* Verified Purchase Only — for review campaigns */ }
						{ 'review' === formData.action_type && (
							<div className="flex flex-col gap-1">
								<div className="flex items-center justify-between gap-3">
									<span className="text-sm font-medium text-text-primary">
										{ __(
											'Verified Purchases Only',
											'power-coupons'
										) }
									</span>
									<Switch
										size="sm"
										value={
											!! formData.verified_purchase_only
										}
										onChange={ () =>
											setFormData(
												'verified_purchase_only',
												! formData.verified_purchase_only
											)
										}
										className="[&>input]:!border-none"
									/>
								</div>
								<HelperText>
									{ __(
										'Only award credits to customers who have actually purchased the reviewed product.',
										'power-coupons'
									) }
								</HelperText>
							</div>
						) }

						{ /* Row 2: Number fields */ }
						<div
							className={ `grid gap-4 grid-cols-1 sm:grid-cols-2 ${
								isOrderEarn ? 'md:grid-cols-4' : ''
							}` }
						>
							<NumberField
								id="campaign-input-earn-value"
								label={ getEarnValueLabel() }
								value={ formData.earn_value ?? '' }
								placeholder="0"
								helper={ getEarnValueHint() }
								error={ errors.earn_value }
								onChange={ ( value ) => {
									setFormData( 'earn_value', value );
									clearError( 'earn_value' );
								} }
							/>
							{ isOrderEarn && (
								<>
									<NumberField
										id="campaign-input-min-order"
										label={ __(
											'Min Order Total',
											'power-coupons'
										) }
										value={ formData.min_order_total ?? '' }
										placeholder={ __(
											'No minimum',
											'power-coupons'
										) }
										helper={ __(
											'Leave blank for no minimum order requirement.',
											'power-coupons'
										) }
										onChange={ ( value ) =>
											setFormData(
												'min_order_total',
												value
											)
										}
									/>
									<NumberField
										id="campaign-input-max-points"
										label={ __(
											'Max Credits Cap',
											'power-coupons'
										) }
										value={ formData.max_points_cap ?? '' }
										placeholder={ __(
											'No cap',
											'power-coupons'
										) }
										helper={ __(
											'Leave blank for no cap on credits per order.',
											'power-coupons'
										) }
										onChange={ ( value ) =>
											setFormData(
												'max_points_cap',
												value
											)
										}
									/>
								</>
							) }
							<NumberField
								id="campaign-input-priority"
								label={ __( 'Priority', 'power-coupons' ) }
								value={ formData.priority ?? '10' }
								placeholder="10"
								helper={ __(
									'Lower number = higher priority. The highest priority campaign wins when multiple match.',
									'power-coupons'
								) }
								onChange={ ( value ) =>
									setFormData( 'priority', value )
								}
							/>
						</div>

						{ /* Row 3: Date fields */ }
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<DateField
								id="campaign-input-start-date"
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
								id="campaign-input-end-date"
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
					</div>

					{ /* Server-level error banner */ }
					<FormErrorBanner message={ formError } />

					{ /* Action buttons */ }
					<div className="flex justify-between">
						<Button
							variant="outline"
							size="md"
							tag="button"
							type="button"
							disabled={ saved }
							onClick={ () => setActiveTab( FormTabs[ 0 ].slug ) }
						>
							{ __( 'Back', 'power-coupons' ) }
						</Button>
						<Button
							variant="primary"
							size="md"
							tag="button"
							type="button"
							disabled={ isLoading || saved }
							loading={ isLoading }
							onClick={ handleCreate }
						>
							{ /* eslint-disable no-nested-ternary */ }
							{ isLoading
								? formData.id
									? __( 'Updating…', 'power-coupons' )
									: __( 'Creating…', 'power-coupons' )
								: formData.id
								? __( 'Update Campaign', 'power-coupons' )
								: __( 'Create Campaign', 'power-coupons' ) }
							{ /* eslint-enable no-nested-ternary */ }
						</Button>
					</div>
				</>
			);
		},
	},
];

// ─── Stepper ─────────────────────────────────────────────────────────────────

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
 *                                  completes when the campaign saves.
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

	return (
		<span
			className={ `${ shape } ${
				'current' === state
					? 'bg-wpcolor text-text-on-color'
					: 'bg-button-disabled text-text-on-button-disabled'
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

// ─── Form card ───────────────────────────────────────────────────────────────

const _ModalContentForm = ( { toggleModalOpen, formData, setFormData } ) => {
	const [ activeTab, setActiveTabInternal ] = useState( FormTabs[ 0 ].slug );
	const [ errors, setErrors ] = useState( {} );
	const [ formError, setFormError ] = useState( '' );
	const [ isLoading, setIsLoading ] = useState( false );
	// The campaign is saved and the modal is about to close on its own.
	const [ saved, setSaved ] = useState( false );
	const closeTimer = useRef( null );

	// The topbar's close button can unmount this while the hold is running.
	useEffect( () => () => clearTimeout( closeTimer.current ), [] );

	const tabIndex = FormTabs.findIndex( ( t ) => t.slug === activeTab );

	const setActiveTab = ( slug ) => {
		setErrors( {} );
		setFormError( '' );
		setActiveTabInternal( slug );
	};

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

	const getNonce = () =>
		window.powerCouponsSettings?.points_nonces?.campaigns || '';

	const saveOffer = async () => {
		setIsLoading( true );
		setFormError( '' );
		setErrors( {} );

		try {
			const actionType = formData.action_type || 'order_earn';
			const body = {
				action: 'power_coupons_save_points_campaign',
				_wpnonce: getNonce(),
				title: formData.title || '',
				description: formData.description || '',
				action_type: actionType,
				earn_type:
					'order_earn' === actionType
						? formData.earn_type || 'fixed'
						: 'fixed',
				earn_value: formData.earn_value || '0',
				min_order_total: formData.min_order_total || '0',
				max_points: formData.max_points_cap || '0',
				priority: formData.priority || '10',
				start_date: formData.start_date || '',
				end_date: formData.end_date || '',
				status: formData.status || 'active',
				verified_purchase_only:
					'review' === actionType && formData.verified_purchase_only
						? 'true'
						: 'false',
			};

			if ( formData.id ) {
				body.id = formData.id;
			}

			const response = await fetch( ajaxurl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams( body ),
			} );
			const result = await response.json();

			if ( result.success ) {
				// Closing here dropped the modal the instant the request
				// returned, so a save read as the dialog vanishing. Mark the
				// last step done, let the check land, then close.
				setSaved( true );
				closeTimer.current = setTimeout( () => {
					toggleModalOpen( true );
				}, SUCCESS_HOLD_MS );
			} else {
				setFormError(
					typeof result.data === 'string'
						? result.data
						: __(
								'Failed to save campaign. Please try again.',
								'power-coupons'
						  )
				);
			}
		} catch ( error ) {
			console.error( 'Error saving campaign:', error );
			setFormError(
				__( 'An error occurred. Please try again.', 'power-coupons' )
			);
		} finally {
			setIsLoading( false );
		}
	};

	return (
		<div className="bg-white w-full max-w-[760px] rounded-md px-4 sm:px-6 py-6 sm:py-8 shadow-[0px_1px_2px_-1px_#0000001A,0px_1px_3px_0px_#0000001A]">
			{ /* Form Header */ }
			<div className="flex items-center gap-2">
				<h3 className="m-0 text-xl sm:text-2xl font-semibold text-text-primary">
					{ formData.id
						? __( 'Edit Campaign', 'power-coupons' ) +
						  ': ' +
						  ( formData.title || '' )
						: __( 'Create a New Campaign', 'power-coupons' ) }
				</h3>
			</div>

			{ /* Form body */ }
			<div className="mt-6">
				<Tabs activeItem={ activeTab }>
					{ /* Numbered circles and connectors, not an underlined tab
					     strip: the steps only report progress, and the strip
					     read as tabs that ignored every click. Back and
					     Save & Continue still do all the moving. */ }
					<ol
						aria-label={ __(
							'Campaign setup steps',
							'power-coupons'
						) }
						className="power-coupons-bogo-steps flex flex-wrap items-center gap-x-5 gap-y-3 lg:gap-x-0 list-none m-0 p-0 pb-[18px] border-0 border-b border-solid border-border-subtle"
					>
						{ FormTabs.map( ( tab, index ) => {
							const state = saved
								? 'done'
								: stepState( tabIndex, index );
							return (
								<Fragment key={ tab.slug }>
									{ index > 0 && (
										// Flexible rather than a fixed 32px, so
										// the steps and the counter never
										// overflow the panel.
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
						<li className="ml-auto pl-6 shrink-0 text-xs font-semibold text-text-secondary whitespace-nowrap">
							{ sprintf(
								/* translators: 1: current step number. 2: total number of steps. */
								__( 'Step %1$d of %2$d', 'power-coupons' ),
								tabIndex + 1,
								FormTabs.length
							) }
						</li>
					</ol>
					<SaveStatus
						announce={ saved }
						message={
							formData.id
								? __( 'Campaign updated.', 'power-coupons' )
								: __( 'Campaign created.', 'power-coupons' )
						}
					/>

					<div className="py-5 flex flex-col text-left gap-6">
						{ FormTabs.map( ( tab ) => (
							<Tabs.Panel key={ tab.slug } slug={ tab.slug }>
								<tab.content
									formData={ formData }
									setFormData={ setFormData }
									setActiveTab={ setActiveTab }
									saveOffer={ saveOffer }
									isLoading={ isLoading }
									saved={ saved }
									errors={ errors }
									setErrors={ setErrors }
									clearError={ clearError }
									formError={ formError }
								/>
							</Tabs.Panel>
						) ) }
					</div>
				</Tabs>
			</div>
		</div>
	);
};

// ─── Modal root (full-screen overlay — same as BOGO) ─────────────────────────

export default ( { toggleModalOpen, editingCampaign } ) => {
	const [ formData, setFormDataState ] = useState(
		editingCampaign
			? ( () => {
					const conds = editingCampaign.conditions
						? JSON.parse( editingCampaign.conditions )
						: {};
					return {
						id: editingCampaign.id,
						title: editingCampaign.title || '',
						description: editingCampaign.description || '',
						action_type:
							editingCampaign.action_type || 'order_earn',
						earn_type: editingCampaign.earn_type || 'fixed',
						earn_value: editingCampaign.earn_value || '',
						min_order_total: editingCampaign.min_order_total || '',
						max_points_cap: editingCampaign.max_points || '',
						priority: editingCampaign.priority || '10',
						start_date: editingCampaign.start_date || '',
						end_date: editingCampaign.end_date || '',
						status: editingCampaign.status || 'active',
						verified_purchase_only: !! conds.verified_purchase_only,
					};
			  } )()
			: {
					title: '',
					description: '',
					action_type: 'order_earn',
					earn_type: 'fixed',
					earn_value: '',
					min_order_total: '',
					max_points_cap: '',
					priority: '10',
					start_date: '',
					end_date: '',
					status: 'active',
					verified_purchase_only: false,
			  }
	);

	const handleFormData = ( key, value ) => {
		setFormDataState( ( prev ) => ( { ...prev, [ key ]: value } ) );
	};

	// The campaigns list stays mounted underneath this overlay, so without a
	// trap one Tab press walks out of the dialog into controls it is covering.
	// Escape closes the wizard the same way the topbar's ✕ does.
	const dialogRef = useRef( null );
	useModalFocus( dialogRef, { onEscape: () => toggleModalOpen() } );

	return (
		<div
			ref={ dialogRef }
			tabIndex={ -1 }
			id="power-coupons-campaign-modal"
			role="dialog"
			aria-modal="true"
			aria-label={
				editingCampaign
					? __( 'Edit campaign', 'power-coupons' )
					: __( 'Create a campaign', 'power-coupons' )
			}
			// fixed, not absolute: nothing locks the page behind, so an
			// absolutely-placed overlay scrolls away and reveals the campaigns
			// list under it once that page is taller than the viewport.
			// overscroll-contain stops the same page scrolling once this one
			// bottoms out.
			className="bg-field-primary-background fixed inset-0 z-[999] overflow-y-auto overscroll-contain focus:outline-none"
		>
			<Topbar
				className="power_coupons-header--content !fixed h-14 min-h-[unset] p-0 border-0 border-b border-solid border-border-subtle bg-white items-center z-10 shadow-[0px_1px_2px_0px_#0000000D]"
				gap={ 0 }
				role="navigation"
				aria-label={ __( 'Campaign Navigation', 'power-coupons' ) }
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
							onClick={ () => toggleModalOpen() }
							aria-label={ __( 'Close', 'power-coupons' ) }
							className="flex items-center justify-center size-9 rounded-md bg-transparent border-none cursor-pointer text-icon-secondary transition-colors duration-200 hover:bg-misc-dropdown-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wpcolor"
						>
							{ RenderIcon( 'close' ) }
						</button>
					</Topbar.Item>
				</Topbar.Right>
			</Topbar>

			{ /* Top-aligned: the topbar is 56px tall and fixed, so the panel
			     starts clear of it instead of floating in the middle of a tall
			     viewport. */ }
			<div className="flex items-start justify-center text-center px-4 sm:px-6 lg:px-0 pt-[88px] pb-12 min-h-full box-border">
				<_ModalContentForm
					toggleModalOpen={ toggleModalOpen }
					formData={ formData }
					setFormData={ handleFormData }
				/>
			</div>
		</div>
	);
};
