import { useState } from 'react';
import { createInterpolateElement } from '@wordpress/element';
import { Checkbox, Input } from '@bsf/force-ui';
import { __ } from '@wordpress/i18n';
import { Header, NavButtons } from '../Components';
import { useOnboardingContext } from '../Context';

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

/**
 * The fields this screen validates, in the order they are read.
 *
 * The order matters twice over: it decides which field the form jumps to when
 * more than one is invalid, and it has to match the visual order for that jump
 * to feel like it goes backwards to the problem.
 */
const FIELDS = {
	user_detail_firstname: {
		id: 'power-coupons-first-name',
		validate: ( value ) =>
			! value || '' === value.trim()
				? __( 'Enter your first name.', 'power-coupons' )
				: '',
	},
	user_detail_lastname: {
		id: 'power-coupons-last-name',
		validate: ( value ) =>
			! value || '' === value.trim()
				? __( 'Enter your last name.', 'power-coupons' )
				: '',
	},
	user_detail_email: {
		id: 'power-coupons-email',
		validate: ( value ) => {
			if ( ! value || '' === value.trim() ) {
				return __( 'Enter an email address.', 'power-coupons' );
			}

			if ( ! EMAIL_PATTERN.test( value ) ) {
				return __(
					"That doesn't look like a valid email address.",
					'power-coupons'
				);
			}

			return '';
		},
	},
};

/**
 * Consent copy with the policy link inline, so the sentence reads as one.
 *
 * Force UI's Label lays its children out with `flex items-center`, so the text
 * and the link would become two side-by-side columns. The wrapper keeps them a
 * single flex item so the sentence flows.
 */
const USAGE_TRACKING_DESCRIPTION = (
	<span className="block">
		{ createInterpolateElement(
			__(
				"We don't collect any personal information, just basic details like your PHP version, admin language, and which features you use. <a>Learn more about what we collect and why.</a>",
				'power-coupons'
			),
			{
				a: (
					// eslint-disable-next-line jsx-a11y/anchor-has-content
					<a
						className="text-field-helper underline hover:text-wphovercolor"
						href="https://store.brainstormforce.com/usage-tracking/?utm_source=dashboard&utm_medium=power-coupons&utm_campaign=docs"
						target="_blank"
						rel="noreferrer"
					/>
				),
			}
		) }
	</span>
);

/**
 * Validation copy, at the same size as the field it belongs to.
 *
 * The message takes its own space and pushes what follows down, rather than
 * sitting in a reserved slot that pads the form out even when it is valid. The
 * footer guards itself against the resulting shift — see NavButtons.
 *
 * The `id` is what makes the message reachable a second time: `role="alert"`
 * announces it once when it appears, and after that a screen reader only finds
 * it again through the input's `aria-describedby`.
 *
 * @param {Object} props
 * @param {string} props.id      Element id the input points at via aria-describedby.
 * @param {string} props.message Error to show, or an empty string for none.
 */
const FieldError = ( { id, message } ) =>
	message ? (
		<span
			id={ id }
			className="block pt-1 text-sm leading-5 text-support-error"
			role="alert"
		>
			{ message }
		</span>
	) : null;

/**
 * The accessibility props a field needs to describe its own error state.
 *
 * @param {string} field   Key in FIELDS.
 * @param {string} message Current error for that field, if any.
 * @return {Object} Props to spread onto the Input.
 */
const errorProps = ( field, message ) => ( {
	'aria-invalid': !! message,
	'aria-describedby': message ? `${ FIELDS[ field ].id }-error` : undefined,
} );

const UserDetails = () => {
	const { currentScreenData, handleData, handleStepCount } =
		useOnboardingContext();
	const { increaseStep } = handleStepCount();

	const [ errors, setErrors ] = useState( {} );

	const setFieldError = ( field, message ) =>
		setErrors( ( prev ) => ( { ...prev, [ field ]: message } ) );

	const handleChange = ( field ) => ( value ) => {
		handleData( field, value );
		setFieldError( field, '' );
	};

	const handleBlur = ( field ) => ( event ) =>
		setFieldError(
			field,
			FIELDS[ field ].validate( event?.target?.value )
		);

	const handleNext = () => {
		const next = {};

		Object.keys( FIELDS ).forEach( ( field ) => {
			next[ field ] = FIELDS[ field ].validate(
				currentScreenData[ field ]
			);
		} );

		setErrors( next );

		const firstInvalid = Object.keys( FIELDS ).find(
			( field ) => next[ field ]
		);

		if ( firstInvalid ) {
			// Send the cursor to the problem rather than leaving the reader to
			// hunt for it — the footer keeps focus during the press, so this is
			// the first focus change of the click.
			document.getElementById( FIELDS[ firstInvalid ].id )?.focus();
			return;
		}

		increaseStep();
	};

	// Enter inside any field should advance the step. A <form> only does that on
	// its own when it has a single input or a submit button, and this one has
	// three inputs and a footer that lives outside it.
	const handleSubmit = ( event ) => {
		event.preventDefault();
		handleNext();
	};

	return (
		<>
			<Header
				heading={ __( 'Stay in the Loop', 'power-coupons' ) }
				subHeading={ __(
					'Get product updates and coupon tips by email. One message when it matters, never a drip campaign.',
					'power-coupons'
				) }
			/>

			{ /* noValidate: the browser's own bubbles would pre-empt the inline
			     messages and skip the focus jump handleNext does. */ }
			<form
				noValidate
				onSubmit={ handleSubmit }
				className="flex flex-col gap-4"
			>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
					<div className="flex flex-col">
						<Input
							id="power-coupons-first-name"
							size="md"
							type="text"
							label={ __( 'First Name', 'power-coupons' ) }
							placeholder={ __( 'Jane', 'power-coupons' ) }
							value={
								currentScreenData.user_detail_firstname || ''
							}
							error={ !! errors.user_detail_firstname }
							required
							autoComplete="given-name"
							onChange={ handleChange( 'user_detail_firstname' ) }
							onBlur={ handleBlur( 'user_detail_firstname' ) }
							{ ...errorProps(
								'user_detail_firstname',
								errors.user_detail_firstname
							) }
						/>
						<FieldError
							id="power-coupons-first-name-error"
							message={ errors.user_detail_firstname }
						/>
					</div>

					<div className="flex flex-col">
						<Input
							id="power-coupons-last-name"
							size="md"
							type="text"
							label={ __( 'Last Name', 'power-coupons' ) }
							placeholder={ __( 'Doe', 'power-coupons' ) }
							value={
								currentScreenData.user_detail_lastname || ''
							}
							error={ !! errors.user_detail_lastname }
							required
							autoComplete="family-name"
							onChange={ handleChange( 'user_detail_lastname' ) }
							onBlur={ handleBlur( 'user_detail_lastname' ) }
							{ ...errorProps(
								'user_detail_lastname',
								errors.user_detail_lastname
							) }
						/>
						<FieldError
							id="power-coupons-last-name-error"
							message={ errors.user_detail_lastname }
						/>
					</div>
				</div>

				<div className="flex flex-col">
					<Input
						id="power-coupons-email"
						size="md"
						type="email"
						label={ __( 'Your Email', 'power-coupons' ) }
						placeholder={ __(
							'you@yourstore.com',
							'power-coupons'
						) }
						value={ currentScreenData.user_detail_email || '' }
						error={ !! errors.user_detail_email }
						required
						autoComplete="email"
						onChange={ handleChange( 'user_detail_email' ) }
						onBlur={ handleBlur( 'user_detail_email' ) }
						{ ...errorProps(
							'user_detail_email',
							errors.user_detail_email
						) }
					/>
					<FieldError
						id="power-coupons-email-error"
						message={ errors.user_detail_email }
					/>
				</div>

				<div>
					<Checkbox
						id="power-coupons-usage-optin"
						size="sm"
						checked={ !! currentScreenData.optin_usage_tracking }
						onChange={ ( value ) =>
							handleData( 'optin_usage_tracking', value )
						}
						label={ {
							heading: __(
								'Help improve Power Coupons by sharing non-sensitive usage data.',
								'power-coupons'
							),
							description: USAGE_TRACKING_DESCRIPTION,
						} }
					/>
				</div>

				{ /* Gives Enter something to submit; the visible primary lives in
				     the shared footer below, outside this form. */ }
				<button type="submit" className="sr-only" tabIndex={ -1 }>
					{ __( 'Continue', 'power-coupons' ) }
				</button>
			</form>

			<NavButtons
				showSkip
				nextLabel={ __( 'Continue', 'power-coupons' ) }
				onNext={ handleNext }
			/>
		</>
	);
};

export default UserDetails;
