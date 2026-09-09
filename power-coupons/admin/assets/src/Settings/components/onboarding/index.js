import {
	Button,
	Dialog,
	Label,
	ProgressSteps,
	Topbar,
	Alert,
} from '@bsf/force-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';
import { X } from 'lucide-react';
import apiFetch from '@wordpress/api-fetch';

import Logo from '../../../../images/logo.svg';
import { PRIMARY_BUTTON_CLASS, RedirectToDashboard, Screens } from './Utils';
import { OnboardingContextProvider } from './Context';
import {
	clearPersistedState,
	hydrateData,
	readPersistedState,
	writePersistedState,
} from './Persist';
import cn from 'classnames';
import OnboardingErrorBoundary from './ErrorBoundary';

const LAST_INDEX = Screens.length - 1;
/** The step that submits — the success screen must not appear before the work is done. */
const SUBMIT_FROM_INDEX = LAST_INDEX - 1;
/**
 * How long to sit on a change before writing the snapshot.
 *
 * The persistence effect fires on every keystroke and each run reads and
 * rewrites the whole snapshot, so an unthrottled version costs two synchronous
 * JSON passes per character typed. Short enough that any real pause in typing
 * commits the answer.
 */
const PERSIST_DEBOUNCE_MS = 400;

/**
 * Resolve the step index the wizard should open on.
 *
 * The URL wins, then the persisted snapshot, then the first step. Restoring
 * straight onto the success screen is never right — that screen means the
 * submit already succeeded.
 *
 * @param {string} slugFromUrl Value of the `step` query param.
 * @return {number} Step index.
 */
const resolveInitialStep = ( slugFromUrl ) => {
	const bySlug = ( slug ) =>
		Screens.findIndex( ( screen ) => screen.slug === slug );

	const fromUrl = bySlug( slugFromUrl );
	const fromStorage = bySlug( readPersistedState().step );
	const index = fromUrl > -1 ? fromUrl : fromStorage;

	if ( index < 0 || index > SUBMIT_FROM_INDEX ) {
		return 0;
	}

	return index;
};

const Wizard = () => {
	const history = useHistory();
	const location = useLocation();

	const [ currentStepIndex, setCurrentStepIndex ] = useState( () =>
		resolveInitialStep(
			new URLSearchParams( window.location.search ).get( 'step' )
		)
	);

	const [ data, setData ] = useState( () =>
		hydrateData( window.powerCouponsSettings.onboarding.defaults )
	);

	// Where focus goes when the step changes, and where it goes when a save is
	// refused. Without the first, focus fell to <body> on every Continue — the
	// button that was focused had just unmounted — so a screen reader announced
	// nothing and a keyboard user restarted their tab run from the top of the
	// admin chrome. Without the second, the Alert rendered at the top of the card
	// while the merchant was at the bottom of it.
	const stepRef = useRef( null );
	const alertRef = useRef( null );

	// The submit is not idempotent: it POSTs to the marketing webhook, writes the
	// settings and installs plugins. Browser Back from the success screen puts the
	// merchant on the add-ons step again with a live Finish button, so the wizard
	// has to remember that the work is already done.
	const hasSubmitted = useRef( false );

	const [ isSaving, setIsSaving ] = useState( false );
	const [ saveError, setSaveError ] = useState( '' );
	const [ showExitConfirm, setShowExitConfirm ] = useState( false );
	const [ isExiting, setIsExiting ] = useState( false );

	const currentScreen = Screens[ currentStepIndex ];
	const StepScreen = currentScreen.component;
	const currentScreenData = data?.[ currentStepIndex ] || {};
	const isLastStep = currentStepIndex === LAST_INDEX;

	/**
	 * Push a step into the URL, preserving the admin page params that got us here.
	 *
	 * @param {number}  index   Step index to move to.
	 * @param {boolean} replace Replace the history entry instead of pushing.
	 */
	const goToStep = useCallback(
		( index, replace = false ) => {
			const params = new URLSearchParams( window.location.search );
			params.set( 'step', Screens[ index ].slug );

			history[ replace ? 'replace' : 'push' ]( {
				search: `?${ params.toString() }`,
			} );
			setCurrentStepIndex( index );
			window.scrollTo( { top: 0, behavior: 'auto' } );
		},
		[ history ]
	);

	// Canonicalise the URL on first paint so Back has somewhere to return to, and
	// so the address bar agrees with what is on screen. It disagrees whenever
	// resolveInitialStep() refused the step it was given — `?step=done` typed by
	// hand, or reloaded after the success screen.
	useEffect( () => {
		const slug = new URLSearchParams( window.location.search ).get(
			'step'
		);

		if ( slug !== Screens[ currentStepIndex ].slug ) {
			goToStep( currentStepIndex, true );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	// Follow the browser's own Back and Forward buttons.
	//
	// Seeded with the search string the wizard mounted on, because this effect
	// also runs on mount: without the seed it reads `?step=done` straight back out
	// of the URL and walks past resolveInitialStep()'s refusal to restore onto the
	// success screen.
	const lastSearch = useRef( location.search );

	useEffect( () => {
		if ( lastSearch.current === location.search ) {
			return;
		}
		lastSearch.current = location.search;

		const slug = new URLSearchParams( location.search ).get( 'step' );
		const index = Screens.findIndex( ( screen ) => screen.slug === slug );

		if ( index > -1 && index !== currentStepIndex ) {
			setCurrentStepIndex( index );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ location.search ] );

	// Keep answers and position recoverable after a reload.
	useEffect( () => {
		if ( isLastStep ) {
			return;
		}

		const timer = window.setTimeout(
			() => writePersistedState( { data, step: currentScreen.slug } ),
			PERSIST_DEBOUNCE_MS
		);

		return () => window.clearTimeout( timer );
	}, [ data, currentScreen.slug, isLastStep ] );

	// Not on first paint: the merchant has just arrived, and yanking focus into
	// the card would throw away wherever the browser put it.
	const hasRendered = useRef( false );

	useEffect( () => {
		if ( ! hasRendered.current ) {
			hasRendered.current = true;
			return;
		}

		// goToStep already scrolled to the top; preventScroll keeps this from
		// fighting it.
		stepRef.current?.focus( { preventScroll: true } );
	}, [ currentStepIndex ] );

	useEffect( () => {
		if ( ! saveError ) {
			return;
		}

		alertRef.current?.scrollIntoView( {
			block: 'nearest',
			behavior: 'smooth',
		} );
		alertRef.current?.focus( { preventScroll: true } );
	}, [ saveError ] );

	const handleData = ( key, value ) => {
		setData( ( prevData ) => {
			const step = {
				...( prevData[ currentStepIndex ] || {} ),
				[ key ]: value,
			};

			// Answering anything on a step un-skips it. Otherwise a merchant who
			// skipped, came back and filled the fields in would have the answers
			// thrown away — `complete_onboarding()` drops any step carrying the
			// flag, whatever else is on it.
			delete step.hasSkipped;

			return { ...prevData, [ currentStepIndex ]: step };
		} );
	};

	/**
	 * Save every answer and install the selected plugins.
	 *
	 * @param {Object} [payload] Answers to send instead of the current state.
	 *                           `data` here is the snapshot from the render that
	 *                           built this callback, so a caller that has just
	 *                           called `setData` has to hand the corrected answers
	 *                           over rather than wait for them to arrive.
	 * @return {Promise<boolean>} Whether the request succeeded.
	 */
	const submitOnboarding = useCallback(
		async ( payload ) => {
			setIsSaving( true );
			setSaveError( '' );

			try {
				const response = await apiFetch( {
					url: window.powerCouponsSettings.onboarding.ajaxUrl,
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( payload || data ),
				} );

				// admin-ajax answers a refusal with HTTP 200 and success:false,
				// which apiFetch resolves — the success screen used to appear over
				// a save that had actually been rejected.
				if ( false === response?.success ) {
					throw new Error( response?.data?.message || '' );
				}
			} catch ( error ) {
				setIsSaving( false );
				setSaveError(
					error?.message ||
						__(
							'We could not finish setting things up. Check your connection and try again. Your answers are saved.',
							'power-coupons'
						)
				);
				return false;
			}

			setIsSaving( false );
			hasSubmitted.current = true;
			clearPersistedState();
			return true;
		},
		[ data ]
	);

	const handleStepCount = useCallback( () => {
		const advance = async ( replace = false, payload ) => {
			// `hasSubmitted` is what stops Finish from running twice after a
			// browser Back off the success screen: a second run would post the
			// merchant to the marketing webhook again and re-save the settings.
			if (
				currentStepIndex === SUBMIT_FROM_INDEX &&
				! hasSubmitted.current
			) {
				const saved = await submitOnboarding( payload );
				if ( ! saved ) {
					return;
				}
			}
			goToStep( Math.min( currentStepIndex + 1, LAST_INDEX ), replace );
		};

		return {
			increaseStep: advance,
			decreaseStep: () => goToStep( Math.max( currentStepIndex - 1, 0 ) ),
			// Skipping is not the same as accepting the defaults. The server drops
			// any step carrying `hasSkipped`, which is what keeps a skipped "Stay
			// in the Loop" from posting the merchant's prefilled name and email to
			// the marketing webhook.
			skipStep: ( replace = false ) => {
				const skipped = {
					...data,
					[ currentStepIndex ]: {
						...( data[ currentStepIndex ] || {} ),
						hasSkipped: true,
					},
				};

				setData( skipped );

				return advance( replace, skipped );
			},
			goToStep,
		};
	}, [ currentStepIndex, goToStep, submitOnboarding, data ] );

	const handleExit = () => {
		setIsExiting( true );

		// Flush past the debounce: this navigates away from the page, and whatever
		// was typed in the last fraction of a second is still worth having when
		// the merchant resumes.
		if ( ! isLastStep ) {
			writePersistedState( { data, step: currentScreen.slug } );
		}

		const skipUrl = window.powerCouponsSettings.onboarding.skipUrl;

		if ( ! skipUrl ) {
			RedirectToDashboard();
			return;
		}

		apiFetch( {
			url: skipUrl,
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			// The step's own `slug` drives the URL and was free to change; this
			// value is already in the analytics dashboard and was not.
			body: JSON.stringify( { exit_step: currentScreen.analyticsSlug } ),
		} ).finally( () => {
			RedirectToDashboard();
		} );
	};

	const exitButton = (
		<Button
			icon={ <X className="size-4" /> }
			iconPosition="right"
			size="xs"
			variant="ghost"
			className="bg-transparent hover:bg-transparent focus:bg-transparent"
			aria-label={ __( 'Exit guided setup', 'power-coupons' ) }
			{ ...( isLastStep && {
				onClick: handleExit,
				loading: isExiting,
				disabled: isExiting,
			} ) }
		>
			<span className="hidden sm:inline">
				{ __( 'Exit Guided Setup', 'power-coupons' ) }
			</span>
		</Button>
	);

	const contextValue = useMemo(
		() => ( {
			handleData,
			handleStepCount,
			currentScreenData,
			// A step that has to hand submitOnboarding() a corrected payload needs
			// to know which key of `data` is its own.
			currentStepIndex,
			data,
			isSaving,
			saveError,
		} ),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			handleStepCount,
			currentScreenData,
			currentStepIndex,
			data,
			isSaving,
			saveError,
		]
	);

	return (
		<OnboardingContextProvider value={ contextValue }>
			<div className="bg-background-secondary w-full min-h-screen pb-16">
				<Topbar className="bg-background-secondary">
					{ /* Equal outer columns keep the stepper on the true viewport centre. */ }
					<Topbar.Left className="flex-1">
						<Topbar.Item>
							<img
								alt={ __( 'Power Coupons', 'power-coupons' ) }
								className="size-[30px]"
								src={ Logo }
							/>
						</Topbar.Item>
					</Topbar.Left>

					<Topbar.Middle className="basis-0">
						<Topbar.Item className="lg:hidden">
							<Label
								size="sm"
								className="whitespace-nowrap font-medium"
							>
								{ sprintf(
									/* translators: 1: current step number, 2: total steps. */
									__( 'Step %1$d of %2$d', 'power-coupons' ),
									currentStepIndex + 1,
									Screens.length
								) }
							</Label>
						</Topbar.Item>
						<Topbar.Item className="hidden lg:flex">
							<ProgressSteps
								size="md"
								variant="number"
								completedVariant="number"
								currentStep={
									isLastStep
										? Screens.length + 1
										: currentStepIndex + 1
								}
							>
								{ Screens.map( ( screen ) => (
									<ProgressSteps.Step
										key={ screen.slug }
										labelText={ screen.label }
									/>
								) ) }
							</ProgressSteps>
						</Topbar.Item>
					</Topbar.Middle>

					<Topbar.Right className="flex-1 justify-end">
						<Topbar.Item>
							{ isLastStep ? (
								exitButton
							) : (
								<Dialog
									open={ showExitConfirm }
									setOpen={ setShowExitConfirm }
									exitOnEsc
									design="simple"
									trigger={ exitButton }
								>
									<Dialog.Backdrop />
									<Dialog.Panel>
										<Dialog.Header>
											<div className="flex items-center justify-between">
												<Dialog.Title>
													{ __(
														'Exit the setup?',
														'power-coupons'
													) }
												</Dialog.Title>
												<Dialog.CloseButton />
											</div>
											<Dialog.Description>
												{ __(
													'Your answers are saved. You can pick up where you left off any time from Power Coupons → Resume Setup.',
													'power-coupons'
												) }
											</Dialog.Description>
										</Dialog.Header>
										<Dialog.Footer>
											<Button
												variant="outline"
												size="sm"
												onClick={ () =>
													setShowExitConfirm( false )
												}
											>
												{ __(
													'Continue Setup',
													'power-coupons'
												) }
											</Button>
											<Button
												variant="primary"
												size="sm"
												className={
													PRIMARY_BUTTON_CLASS
												}
												loading={ isExiting }
												disabled={ isExiting }
												onClick={ handleExit }
											>
												{ __(
													'Exit Setup',
													'power-coupons'
												) }
											</Button>
										</Dialog.Footer>
									</Dialog.Panel>
								</Dialog>
							) }
						</Topbar.Item>
					</Topbar.Right>
				</Topbar>

				<main className="px-4 md:px-0">
					<div
						className={ cn(
							'relative box-border mx-auto p-5 sm:p-8 mt-6 md:mt-10 border border-solid border-border-subtle bg-background-primary rounded-xl shadow-sm flex flex-col gap-6',
							currentScreen.width
						) }
					>
						{ saveError && (
							<div
								ref={ alertRef }
								tabIndex={ -1 }
								className="outline-none"
							>
								<Alert
									content={ saveError }
									variant="error"
									design="inline"
									className="shadow-none"
									title={ __(
										'Setup could not be completed',
										'power-coupons'
									) }
								/>
							</div>
						) }
						{ /* The step is a labelled region so moving focus here on a
						     step change announces which step it is. */ }
						<div
							ref={ stepRef }
							tabIndex={ -1 }
							role="region"
							aria-label={ sprintf(
								/* translators: 1: current step number, 2: total steps, 3: step name. */
								__(
									'Step %1$d of %2$d: %3$s',
									'power-coupons'
								),
								currentStepIndex + 1,
								Screens.length,
								currentScreen.label
							) }
							className="outline-none flex flex-col gap-6"
						>
							<StepScreen />
						</div>
					</div>
				</main>
			</div>
		</OnboardingContextProvider>
	);
};

const Onboarding = () => (
	<OnboardingErrorBoundary>
		<Wizard />
	</OnboardingErrorBoundary>
);

export default Onboarding;
