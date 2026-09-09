import { Checkbox, Loader } from '@bsf/force-ui';
import { useEffect, useRef, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { Check, Puzzle } from 'lucide-react';
import { Header, NavButtons } from '../Components';
import { PluginStatusDisplay, RecommendedPlugins } from '../Utils';
import { useOnboardingContext } from '../Context';
import cn from 'classnames';

/**
 * What the server found when the page loaded.
 *
 * Deliberately left untouched: the auto-advance decision below is about the
 * state the wizard started in, not the state it has since produced.
 */
const pluginStatuses =
	window.powerCouponsSettings?.onboarding?.plugins_status || {};

/**
 * What this visit to the wizard installed.
 *
 * Module scope on purpose. Browser-Back from the success screen remounts this
 * step, and a fresh mount seeded only from `pluginStatuses` would report a
 * plugin we had just installed as "Not installed".
 */
const installedThisSession = {};

const PluginRow = ( { plugin, isLast } ) => {
	const status = plugin.status;
	const display =
		PluginStatusDisplay[ status ] || PluginStatusDisplay[ 'not-installed' ];
	const isActive = 'active' === status;
	const isWorking = 'installing' === status;
	// While the run is under way the list is a progress report, not a form.
	const isLocked = isActive || plugin.busy;

	let indicator = (
		<span
			className="flex"
			onClick={ ( event ) => event.stopPropagation() }
			role="presentation"
		>
			<Checkbox
				size="sm"
				checked={ !! plugin.checked }
				disabled={ plugin.busy }
				onChange={ plugin.onChange }
				aria-label={ sprintf(
					/* translators: %s: plugin name. */
					__( 'Install %s', 'power-coupons' ),
					plugin.name
				) }
			/>
		</span>
	);

	if ( isWorking ) {
		indicator = <Loader variant="primary" size="sm" />;
	} else if ( isActive ) {
		// A circle, where the selection control is a rounded square: the shape
		// is what separates "already done, nothing to do" from "you chose this,
		// it will be installed".
		indicator = (
			<span className="size-5 rounded-full bg-badge-background-green flex items-center justify-center">
				<Check
					className="size-3 stroke-[3] text-support-success"
					aria-hidden="true"
				/>
			</span>
		);
	}

	return (
		<div
			className={ cn(
				'flex items-start sm:items-center gap-3.5 px-4 py-3.5',
				! isLast &&
					'border-0 border-b border-solid border-border-subtle',
				isActive && 'opacity-70',
				! isLocked && 'cursor-pointer hover:bg-background-secondary'
			) }
			onClick={ () => {
				if ( ! isLocked ) {
					plugin.onChange( ! plugin.checked );
				}
			} }
			role="presentation"
		>
			<span className="size-5 shrink-0 flex items-center justify-center">
				{ indicator }
			</span>

			{ /* Fixed tile so a transparent glyph and a solid square read as the
			     same weight, and the row never reflows while logos load. */ }
			<span className="relative size-8 shrink-0 rounded-lg border border-solid border-border-subtle bg-background-primary flex items-center justify-center overflow-hidden">
				<Puzzle
					className="size-4 text-icon-secondary"
					aria-hidden="true"
				/>
				<img
					src={ plugin.logo }
					alt=""
					width={ 32 }
					height={ 32 }
					loading="lazy"
					className="absolute inset-0 size-full object-contain p-0.5 box-border bg-background-primary"
					onError={ ( event ) => {
						event.currentTarget.style.display = 'none';
					} }
				/>
			</span>

			{ /* The status keeps its own column from `sm` up, and drops below
			     the description on a phone rather than squeezing it into a
			     five-line ribbon. One node either way, so a screen reader
			     hears the state once. */ }
			<span className="flex-1 min-w-0 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
				<span className="flex-1 min-w-0 flex flex-col gap-0.5">
					<span className="text-sm font-semibold text-text-primary">
						{ plugin.name }
					</span>
					<span className="text-sm font-normal text-text-secondary">
						{ plugin.description }
					</span>
				</span>

				<span
					className={ cn(
						'shrink-0 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
						display.text
					) }
				>
					{ display.dot && (
						<span
							className={ cn(
								'size-1.5 rounded-full',
								display.dot
							) }
							aria-hidden="true"
						/>
					) }
					{ display.label }
				</span>
			</span>
		</div>
	);
};

const RecommendPlugins = () => {
	const {
		currentScreenData,
		currentStepIndex,
		data,
		handleData,
		handleStepCount,
		isSaving,
		saveError,
	} = useOnboardingContext();

	// Live state per plugin, seeded from what this session already installed and
	// then from what the server found on page load.
	const [ statuses, setStatuses ] = useState( () => ( {
		...RecommendedPlugins.reduce(
			( seed, plugin ) => ( {
				...seed,
				[ plugin.slug ]:
					installedThisSession[ plugin.slug ] ||
					pluginStatuses[ plugin.slug ] ||
					'not-installed',
			} ),
			{}
		),
	} ) );
	// { done, total } while installing, null otherwise.
	const [ progress, setProgress ] = useState( null );

	// Nothing to install — save the answers and move on rather than showing an
	// actionless step.
	const allActive = RecommendedPlugins.every(
		( plugin ) => 'active' === pluginStatuses[ plugin.slug ]
	);
	const autoAdvanceStarted = useRef( false );

	useEffect( () => {
		if ( ! allActive || autoAdvanceStarted.current ) {
			return;
		}
		autoAdvanceStarted.current = true;
		// Replace, so Back never lands on a step that bounces forward again.
		handleStepCount().increaseStep( true );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	// The auto-advance above is one-shot, so a refused save used to leave this
	// spinner turning for good with nothing on the step able to move. The shell
	// already renders the error itself; this only has to offer the way out.
	if ( allActive && saveError ) {
		return (
			<>
				<Header
					heading={ __( 'Almost There', 'power-coupons' ) }
					subHeading={ __(
						'Every recommended plugin is already active, so there was nothing to install. Saving your answers is all that is left.',
						'power-coupons'
					) }
				/>
				<NavButtons
					nextLabel={ __( 'Try Again', 'power-coupons' ) }
					nextLoading={ isSaving }
					onNext={ () => handleStepCount().increaseStep( true ) }
				/>
			</>
		);
	}

	if ( allActive ) {
		return (
			<div className="flex flex-col items-center justify-center gap-3 p-8">
				<Loader variant="primary" size="lg" />
				<p className="m-0 text-sm text-text-secondary">
					{ __( 'Finishing setup…', 'power-coupons' ) }
				</p>
			</div>
		);
	}

	const selectable = RecommendedPlugins.filter(
		( plugin ) => 'active' !== statuses[ plugin.slug ]
	);
	const selectedCount = selectable.filter(
		( plugin ) => currentScreenData[ plugin.slug ]
	).length;

	/**
	 * Install the chosen plugins one at a time, then finish onboarding.
	 *
	 * One request per plugin is what makes the progress real: a single request
	 * for the whole list left the merchant watching a disabled button with no
	 * idea which plugin was being fetched, or whether anything was happening.
	 */
	const installThenFinish = async () => {
		const queue = selectable.filter(
			( plugin ) => currentScreenData[ plugin.slug ]
		);

		setProgress( { done: 0, total: queue.length } );

		// Collected here rather than read back off `currentScreenData`: the
		// handleData() call below lands in the next render, and the finishing
		// request is sent from this one. Without this the completion request
		// silently re-ran the very install the row says failed.
		const failed = [];

		for ( let index = 0; index < queue.length; index++ ) {
			const { slug } = queue[ index ];

			setStatuses( ( prev ) => ( { ...prev, [ slug ]: 'installing' } ) );

			try {
				// eslint-disable-next-line no-await-in-loop
				const response = await apiFetch( {
					url: window.powerCouponsSettings.onboarding.installUrl,
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( { slug } ),
				} );

				// admin-ajax answers a refusal with HTTP 200 and success:false,
				// which apiFetch resolves — without this a failed install would
				// report itself as active.
				if ( false === response?.success ) {
					throw new Error( response?.data?.message || '' );
				}

				installedThisSession[ slug ] = 'active';
				setStatuses( ( prev ) => ( { ...prev, [ slug ]: 'active' } ) );
			} catch ( error ) {
				installedThisSession[ slug ] = 'failed';
				setStatuses( ( prev ) => ( { ...prev, [ slug ]: 'failed' } ) );
				failed.push( slug );
				// The failure is already on screen; untick it so the finishing
				// request doesn't silently retry it behind a spinner.
				handleData( slug, false );
			}

			setProgress( { done: index + 1, total: queue.length } );
		}

		setProgress( null );

		const payload = failed.length
			? {
					...data,
					[ currentStepIndex ]: {
						...currentScreenData,
						...Object.fromEntries(
							failed.map( ( slug ) => [ slug, false ] )
						),
					},
			  }
			: undefined;

		handleStepCount().increaseStep( false, payload );
	};

	/**
	 * Label the primary button with whatever the wizard is doing right now.
	 *
	 * @return {string} Button label.
	 */
	const nextLabel = () => {
		if ( progress ) {
			return sprintf(
				/* translators: 1: plugin being installed, 2: total to install. */
				__( 'Installing %1$d of %2$d…', 'power-coupons' ),
				Math.min( progress.done + 1, progress.total ),
				progress.total
			);
		}

		if ( isSaving ) {
			return __( 'Setting things up…', 'power-coupons' );
		}

		if ( selectedCount ) {
			return sprintf(
				/* translators: %d: number of selected plugins. */
				__( 'Install %d & Finish', 'power-coupons' ),
				selectedCount
			);
		}

		return __( 'Finish Setup', 'power-coupons' );
	};

	return (
		<>
			<Header
				heading={ __(
					'Add More Power to Your Store',
					'power-coupons'
				) }
				subHeading={ __(
					'These tools can help you build your website faster and easier. Try them out and see how they can help your website grow.',
					'power-coupons'
				) }
			/>

			<div className="border border-solid border-border-subtle rounded-lg overflow-hidden">
				{ RecommendedPlugins.map( ( plugin, index ) => (
					<PluginRow
						key={ plugin.slug }
						isLast={ index === RecommendedPlugins.length - 1 }
						plugin={ {
							...plugin,
							status: statuses[ plugin.slug ],
							busy: !! progress,
							checked: currentScreenData[ plugin.slug ],
							onChange: ( value ) =>
								handleData( plugin.slug, value ),
						} }
					/>
				) ) }
			</div>

			{ /* The row spinners and the button label are both silent to a
			     screen reader — a changed button label is not announced. This
			     is the only running commentary those merchants get on the one
			     step that writes to their site. */ }
			<span className="sr-only" role="status" aria-live="polite">
				{ progress
					? sprintf(
							/* translators: 1: plugin being installed, 2: total to install. */
							__(
								'Installing plugin %1$d of %2$d.',
								'power-coupons'
							),
							Math.min( progress.done + 1, progress.total ),
							progress.total
					  )
					: '' }
			</span>

			<NavButtons
				nextLoading={ isSaving || !! progress }
				nextLabel={ nextLabel() }
				onNext={ installThenFinish }
			/>
		</>
	);
};

export default RecommendPlugins;
