import { Check } from 'lucide-react';
import cn from 'classnames';

/**
 * A single selectable tile.
 *
 * The whole tile is the hit target because the <label> wraps a visually hidden
 * radio — the previous markup nested a RadioButton inside a <button>, so a
 * click fired both controls and the semantics were invalid.
 *
 * `focus-within` on the label is what makes the hidden radio visible again: the
 * input is `sr-only`, so arrowing through the styles moved focus with nothing on
 * screen to show for it. `peer-focus-*` cannot do this job — the input is a
 * child of the label, not a sibling, and a `focus-within:outline` lost its width
 * to the admin stylesheet, so this rings with a box-shadow like Force UI's own
 * controls do.
 *
 * @param {Object}   props
 * @param {string}   props.group    Radio group name.
 * @param {string}   props.value    This option's value.
 * @param {string}   props.name     Visible option name.
 * @param {boolean}  props.checked  Whether this option is selected.
 * @param {Function} props.onChange Called with the value when picked.
 * @param {Node}     props.children The preview to show inside the tile.
 */
export default ( { group, value, name, checked, onChange, children } ) => {
	const inputId = `${ group }-${ value }`;

	return (
		<label
			htmlFor={ inputId }
			className={ cn(
				'flex flex-col gap-4 p-4 rounded-lg cursor-pointer transition-all bg-background-primary border border-solid',
				'focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-wpcolor',
				checked
					? 'border-border-interactive'
					: 'border-border-subtle hover:border-border-interactive'
			) }
		>
			<input
				id={ inputId }
				type="radio"
				name={ group }
				value={ value }
				checked={ checked }
				onChange={ () => onChange( value ) }
				className="sr-only"
			/>

			{ /* The name sits with the mark rather than under the preview, so
			     the thing being chosen and the state of that choice read as one
			     line instead of bracketing the artwork. */ }
			<span className="flex items-center gap-2">
				<span
					aria-hidden="true"
					className={ cn(
						'shrink-0 size-5 rounded-full border border-solid flex items-center justify-center transition-colors',
						checked
							? 'bg-toggle-on border-toggle-on'
							: 'bg-background-primary border-field-border'
					) }
				>
					{ checked && (
						<Check className="size-3 stroke-[3] text-text-on-color" />
					) }
				</span>

				<span
					className={ cn(
						'text-sm font-semibold leading-5',
						checked ? 'text-wpcolor' : 'text-text-primary'
					) }
				>
					{ name }
				</span>
			</span>

			<span className="w-full flex justify-center">{ children }</span>
		</label>
	);
};
