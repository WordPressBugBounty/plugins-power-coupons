import { Button } from '@bsf/force-ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { __ } from '@wordpress/i18n';
import { useOnboardingContext } from '../Context';
import { PRIMARY_BUTTON_CLASS } from '../Utils';

/**
 * Keep the focused field focused while a footer button is pressed.
 *
 * Blur validation inserts its message between mousedown and mouseup, which
 * moved the button out from under the pointer and swallowed the click.
 * Suppressing the default mousedown behaviour stops the blur, so the layout
 * holds still until the click has landed; the handler validates everything
 * itself, so nothing is skipped.
 *
 * @param {MouseEvent} event Mousedown on the footer.
 */
const keepFocusOnMouseDown = ( event ) => event.preventDefault();

/**
 * Back / Skip / Next footer.
 *
 * `ml-auto` on the right-hand group matters: with `justify-between` alone, a
 * step that hides Back pushed its primary button to the left edge.
 *
 * @param {Object}   props
 * @param {string}   [props.backLabel]     Label for Back.
 * @param {string}   [props.nextLabel]     Label for the primary button.
 * @param {boolean}  [props.showBack]      Render the Back button.
 * @param {boolean}  [props.showSkip]      Render the Skip button.
 * @param {boolean}  [props.nextLoading]   Put the primary button in its loading state.
 * @param {boolean}  [props.nextFullWidth] Stretch the primary button (entry/exit screens).
 * @param {Function} [props.onNext]        Override the default "advance" handler.
 * @param {Function} [props.onSkip]        Override the default "skip" handler.
 */
export default ( {
	backLabel,
	nextLabel,
	showBack = true,
	showSkip = false,
	nextLoading = false,
	nextFullWidth = false,
	onNext,
	onSkip,
} ) => {
	const { handleStepCount } = useOnboardingContext();
	// Bare handlers would hand advance() the click event as its `replace` flag,
	// which silently swallowed the history entry for the step being left.
	const { increaseStep, decreaseStep, skipStep } = handleStepCount();

	if ( nextFullWidth ) {
		return (
			<Button
				variant="primary"
				size="md"
				className={ `w-full ${ PRIMARY_BUTTON_CLASS }` }
				onClick={ onNext || ( () => increaseStep() ) }
				loading={ nextLoading }
				disabled={ nextLoading }
			>
				{ nextLabel || __( 'Next', 'power-coupons' ) }
			</Button>
		);
	}

	return (
		<div
			className="flex justify-between items-center gap-6 mt-4"
			onMouseDown={ keepFocusOnMouseDown }
		>
			{ showBack && (
				<Button
					variant="outline"
					size="md"
					icon={ <ChevronLeft /> }
					onClick={ decreaseStep }
					disabled={ nextLoading }
				>
					{ backLabel || __( 'Back', 'power-coupons' ) }
				</Button>
			) }
			<div className="flex justify-end items-center gap-3 ml-auto">
				{ showSkip && (
					<Button
						variant="ghost"
						size="md"
						className="text-text-secondary hover:text-text-primary"
						onClick={ onSkip || ( () => skipStep() ) }
						disabled={ nextLoading }
					>
						{ __( 'Skip', 'power-coupons' ) }
					</Button>
				) }
				<Button
					variant="primary"
					size="md"
					className={ PRIMARY_BUTTON_CLASS }
					icon={ <ChevronRight /> }
					iconPosition="right"
					onClick={ onNext || ( () => increaseStep() ) }
					loading={ nextLoading }
					disabled={ nextLoading }
				>
					{ nextLabel || __( 'Next', 'power-coupons' ) }
				</Button>
			</div>
		</div>
	);
};
