import ParsedHtml from '../common/ParsedHtml';
import { useId } from '@wordpress/element';
import { Label } from '@bsf/force-ui';

/**
 * One settings row: caption, helper text and the control itself.
 *
 * Two things here are load-bearing and easy to undo by accident:
 *
 * - Disabled rows use `inert`, not just `pointer-events-none`. Pointer events
 *   stop the mouse and do nothing to the keyboard, so a greyed-out row stayed
 *   tabbable and writable and its value still saved. `inert` removes the
 *   subtree from the tab order, the accessibility tree and hit-testing, and
 *   the controls below also take their own `disabled` so the state holds in
 *   browsers still rolling `inert` out.
 * - The helper text is not `aria-hidden`. It carries the `aria-describedby`
 *   target, so hiding it withheld the description from exactly the assistive
 *   tech that was pointed at it.
 *
 * @param {Object} props Component props; see the destructure below.
 * @return {JSX.Element} One settings row.
 */
function FieldWrapper( props ) {
	const {
		children,
		title,
		description,
		badge,
		content,
		type = 'inline',
		disabled = false,
		controlId,
	} = props;

	// Fallback ID for fields that don't pass a deterministic one of their own.
	// It still gives the caption and helper text stable ids to be referenced
	// by, but it must not become a `<label for>` target: nothing carries it,
	// so the association would be a promise the markup can't keep. Composite
	// fields with no single labelable control (the template picker) rely on
	// the `role="group"` + `aria-labelledby` pairing below instead.
	const generatedId = useId();
	const fieldId = controlId || generatedId;
	const titleId = `${ fieldId }-title`;
	const descriptionId = `${ fieldId }-description`;

	return (
		<section
			className={ `flex ${
				type === 'block' ? 'flex-col' : 'flex-col sm:flex-row'
			} py-6 justify-between gap-2 lg:gap-5 border-0 border-b border-solid border-border-subtle last:border-b-0${
				disabled ? ' pointer-events-none select-none' : ''
			}` }
			aria-labelledby={ title ? titleId : undefined }
			inert={ disabled ? '' : undefined }
		>
			{ ( title || description ) && (
				<div
					className={ `${
						type === 'block' ? 'w-full' : 'w-full sm:w-[70%]'
					}` }
				>
					{ title && (
						<Label
							className={ `font-medium mb-1${
								disabled ? ' text-text-tertiary' : ''
							}` }
							htmlFor={ controlId || undefined }
							size="sm"
							id={ titleId }
							as="h3"
						>
							{ title }
						</Label>
					) }
					{ description && (
						<>
							<p
								className={ `font-normal text-sm m-0 ${
									disabled
										? 'text-text-tertiary'
										: 'text-text-field-helper'
								}` }
								id={ descriptionId }
							>
								<ParsedHtml html={ description } />
							</p>
							{ badge && (
								<span
									className="inline-flex items-center mt-1 px-2.5 py-1 rounded-md text-xs font-medium bg-wpcolorfaded !text-wpcolor"
									role="status"
									aria-label={ `Status: ${ badge }` }
								>
									{ badge }
								</span>
							) }
						</>
					) }
				</div>
			) }
			{ content && (
				<div
					className="pr-16 pb-8 w-full"
					role="group"
					aria-labelledby={ title ? titleId : '' }
					aria-describedby={ description ? descriptionId : '' }
				>
					{ children }
				</div>
			) }

			{ ! content && children }
		</section>
	);
}

export default FieldWrapper;
