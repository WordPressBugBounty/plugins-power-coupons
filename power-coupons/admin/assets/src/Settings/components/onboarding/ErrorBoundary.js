import { Component } from 'react';
import { Button } from '@bsf/force-ui';
import { __ } from '@wordpress/i18n';
import { PRIMARY_BUTTON_CLASS, RedirectToDashboard } from './Utils';

/**
 * Catches a render error in any step.
 *
 * Without this a throw anywhere in the wizard leaves the merchant on a blank
 * white admin page with no way out.
 */
class OnboardingErrorBoundary extends Component {
	constructor( props ) {
		super( props );
		this.state = { hasError: false };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch( error ) {
		// eslint-disable-next-line no-console
		console.error( 'Power Coupons onboarding failed to render:', error );
	}

	render() {
		if ( ! this.state.hasError ) {
			return this.props.children;
		}

		return (
			<div className="bg-background-secondary w-full min-h-screen pb-16">
				<div className="md:w-[36rem] box-border mx-auto p-5 sm:p-8 mt-6 md:mt-10 border border-solid border-border-subtle bg-background-primary rounded-xl shadow-sm flex flex-col gap-4">
					<h1 className="m-0 text-xl font-semibold text-text-primary">
						{ __(
							'The setup wizard hit a problem',
							'power-coupons'
						) }
					</h1>
					<p className="m-0 text-sm text-text-secondary">
						{ __(
							'Nothing has been changed on your store. You can configure everything from the settings screen instead, or reload to try the wizard again.',
							'power-coupons'
						) }
					</p>
					<div className="flex flex-col sm:flex-row gap-3">
						<Button
							variant="primary"
							size="sm"
							className={ PRIMARY_BUTTON_CLASS }
							onClick={ RedirectToDashboard }
						>
							{ __( 'Go To Settings', 'power-coupons' ) }
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={ () => window.location.reload() }
						>
							{ __( 'Reload And Retry', 'power-coupons' ) }
						</Button>
					</div>
				</div>
			</div>
		);
	}
}

export default OnboardingErrorBoundary;
