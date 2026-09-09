import React, { useState, useEffect, useRef } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import parse from 'html-react-parser';
import { CircleCheckBig, KeyRound } from 'lucide-react';
import { Title, Button, Input, Label, Container, Loader } from '@bsf/force-ui';

import ConfirmationModal from '../common/ConfirmationModal';
import { useStateValue } from '../Data';

function LicenseSettings() {
	const [ data, dispatch ] = useStateValue();

	const isLicenseActivated =
		data.license_status && 'Activated' === data.license_status
			? true
			: false;

	const [ licenseActivationProcess, setLicenseActivationProcess ] =
		useState( false );
	const [ licenseKey, setLicenseKey ] = useState( '' );
	const [ licenseErrors, setLicenseErrors ] = useState( false );
	const [ confirmingDeactivate, setConfirmingDeactivate ] = useState( false );
	// A plain flag, not the nonce: an absent nonce would leave a value-carrying
	// ref falsy, the "already confirmed" test would never pass, and confirming
	// would reopen the dialog instead of deactivating.
	const deactivateConfirmedRef = useRef( false );

	const inputRef = useRef( null );

	const disabledBtnClasses =
		'disabled:pointer-events-none disabled:bg-misc-progress-background disabled:text-while disabled:border-none disabled:text-text-tertiary';

	useEffect( () => {
		if ( inputRef.current && ! isLicenseActivated ) {
			inputRef.current.focus();
		}
	}, [ isLicenseActivated ] );

	/**
	 * Label for the activate/deactivate button, including its in-flight state.
	 */
	const getButtonLabel = () => {
		if ( licenseActivationProcess ) {
			return isLicenseActivated
				? __( 'Deactivating…', 'power-coupons' )
				: __( 'Activating…', 'power-coupons' );
		}

		return isLicenseActivated
			? __( 'Deactivate License', 'power-coupons' )
			: __( 'Activate License', 'power-coupons' );
	};

	/**
	 * Ajax call to activate/deactivate the license key.
	 *
	 * Reads its nonce from the localized settings rather than off the clicked
	 * button, so the confirmed-deactivation path can call it without a DOM
	 * event to carry one.
	 *
	 * @param {Event} [event] The click that started it, when there was one.
	 */
	const activateLicense = function ( event ) {
		event?.preventDefault();

		setLicenseErrors( false );

		if ( '' === licenseKey && ! isLicenseActivated ) {
			setLicenseErrors(
				__( 'Please enter a valid license key!', 'power-coupons' )
			);
			return;
		}

		const isDeactivating = isLicenseActivated;
		const nonces = powerCouponsSettings.license_nonces || {};
		const ajaxNonce = isDeactivating
			? nonces.deactivate_license_nonce
			: nonces.activate_license_nonce;

		// Deactivating severs updates and support for this site, and used to
		// happen on a single unconfirmed click.
		if ( isDeactivating && ! deactivateConfirmedRef.current ) {
			setConfirmingDeactivate( true );
			return;
		}
		deactivateConfirmedRef.current = false;
		const ajaxAction = isDeactivating
			? 'power_coupons_deactivate_license'
			: 'power_coupons_activate_license';

		event?.currentTarget?.blur();
		setLicenseActivationProcess( true );

		const formData = new window.FormData();

		formData.append( 'action', ajaxAction );
		formData.append( 'license_key', licenseKey );
		formData.append( 'security', ajaxNonce );

		apiFetch( {
			url: powerCouponsSettings.ajax_url,
			method: 'POST',
			body: formData,
		} )
			.then( ( respData ) => {
				if ( respData.success ) {
					dispatch( {
						type: 'CHANGE',
						data: {
							...data,
							license_status: isDeactivating
								? 'Deactivated'
								: 'Activated',
						},
					} );

					setLicenseKey( '' );
				} else {
					const msg = respData.data.error || respData.data || '';

					if ( msg ) {
						setLicenseErrors( msg );
					} else {
						setLicenseErrors(
							__(
								'Unknown error occurred while activating the license.',
								'power-coupons'
							)
						);
					}
				}
			} )
			.catch( () => {
				setLicenseErrors(
					__(
						'A network error occurred. Please try again.',
						'power-coupons'
					)
				);
			} )
			.finally( () => {
				setLicenseActivationProcess( false );
			} );
	};

	const deactivateConfirmed = () => {
		deactivateConfirmedRef.current = true;
		activateLicense();
	};

	return (
		<>
			<Title
				description=""
				icon={ null }
				size="md"
				tag="h2"
				title={ __( 'License', 'power-coupons' ) }
				className="mb-6 [&_h2]:text-text-primary text-xl"
			/>
			<div className="h-auto bg-background-primary rounded-xl shadow-sm">
				<Container
					containerType="flex"
					direction="column"
					className="p-6"
				>
					<Container.Item>
						<Label
							className="font-semibold mb-1"
							htmlFor="power-coupons-license-key"
							size="md"
						>
							{ __( 'License Key', 'power-coupons' ) }
						</Label>
						<p className="font-normal text-sm text-text-field-helper m-0 mb-4">
							{ isLicenseActivated
								? __(
										'Your license is active on this site. Professional support and automatic updates for Power Coupons Pro are enabled.',
										'power-coupons'
								  )
								: parse(
										sprintf(
											// translators: %1$s: link html start, %2$s: link html end
											__(
												"Enter your valid license key below to activate Power Coupons Pro. If you don't have a license key yet, you can get it from %1$shere%2$s.",
												'power-coupons'
											),
											'<a href="https://my.cartflows.com/account/api-keys/" class="text-wpcolor hover:text-wphovercolor no-underline" target="_blank">',
											'</a>'
										)
								  ) }
						</p>
					</Container.Item>
					<Container.Item className="w-full relative flex gap-4 flex-col sm:flex-row">
						<div className="flex-grow relative">
							{ isLicenseActivated ? (
								<Input
									id="power-coupons-license-key"
									type="text"
									size="md"
									className="power-coupons-license-key [&_input]:text-support-success [&_input]:disabled:text-support-success [&_input]:disabled:bg-background-secondary"
									prefix={
										<CircleCheckBig className="text-support-success" />
									}
									value={ __(
										'Your license key is activated',
										'power-coupons'
									) }
									aria-label={ __(
										'License key status',
										'power-coupons'
									) }
									disabled
									readOnly
								/>
							) : (
								<Input
									id="power-coupons-license-key"
									type="text"
									size="md"
									prefix={
										<KeyRound className="text-text-tertiary" />
									}
									suffix={
										licenseErrors ? (
											<svg
												className="text-field-required"
												viewBox="0 0 20 20"
												fill="currentColor"
												aria-hidden="true"
											>
												<path
													fillRule="evenodd"
													d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
													clipRule="evenodd"
												/>
											</svg>
										) : null
									}
									className={ `h-full w-full power-coupons-license-key focus:[&>input]:ring-focus ${
										licenseErrors
											? '!border-border-subtle focus:border-wpcolor !shadow-none !outline-0 !outline-none'
											: ''
									}` }
									name={
										'power_coupons_setting[license_key]'
									}
									value={ licenseKey }
									onChange={ ( value ) =>
										setLicenseKey( value )
									}
									placeholder={ __(
										'Paste your license key here',
										'power-coupons'
									) }
									aria-label={ __(
										'License key input',
										'power-coupons'
									) }
									autoComplete="off"
									ref={ inputRef }
								/>
							) }
						</div>
						<div>
							<Button
								variant={
									isLicenseActivated ? 'outline' : 'primary'
								}
								className={ `${ disabledBtnClasses } w-full focus:ring-0 ${
									isLicenseActivated
										? 'text-wpcolor hover:text-wpcolor bg-white hover:bg-wpcolorfaded outline outline-1 outline-wpcolor hover:outline-wpcolor'
										: 'bg-wpcolor hover:bg-wphovercolor outline-0 hover:outline-0'
								}` }
								onClick={ activateLicense }
								disabled={ licenseActivationProcess }
								icon={
									licenseActivationProcess && (
										<Loader
											className="bg-transparent"
											icon={ null }
											size="sm"
											variant={
												isLicenseActivated
													? 'primary'
													: 'secondary'
											}
										/>
									)
								}
								iconPosition="right"
							>
								{ getButtonLabel() }
							</Button>
						</div>
					</Container.Item>
					{ licenseErrors && (
						<Container.Item>
							<div
								className="license-errors text-sm text-field-color-error"
								role="alert"
							>
								{ parse( String( licenseErrors ) ) }
							</div>
						</Container.Item>
					) }
				</Container>
			</div>
			<ConfirmationModal
				isOpen={ confirmingDeactivate }
				onClose={ () => {
					deactivateConfirmedRef.current = false;
					setConfirmingDeactivate( false );
				} }
				onConfirm={ () => {
					setConfirmingDeactivate( false );
					deactivateConfirmed();
				} }
				title={ __( 'Deactivate this license?', 'power-coupons' ) }
				message={ __(
					'This site will stop receiving automatic updates and support for Power Coupons Pro until a license is activated again.',
					'power-coupons'
				) }
				confirmText={ __( 'Deactivate License', 'power-coupons' ) }
			/>
		</>
	);
}

export default LicenseSettings;
