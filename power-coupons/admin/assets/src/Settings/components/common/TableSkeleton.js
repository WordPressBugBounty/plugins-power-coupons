import { Skeleton, Table } from '@bsf/force-ui';
import cn from 'classnames';

/**
 * Placeholder rows drawn inside a table's own markup while its data loads.
 *
 * The rows go in the real <Table>, under the real header, so the column
 * widths, cell padding, checkbox column and row height are the loaded
 * table's — the placeholder swaps for data without the layout moving.
 *
 * @param {Object} props
 * @param {number} props.rows  How many placeholder rows to draw.
 * @param {Array}  props.cells One entry per column: `{ className, content }`.
 */
const SkeletonRows = ( { rows = 5, cells } ) =>
	Array.from( { length: rows } ).map( ( _, rowIndex ) => (
		<Table.Row
			key={ rowIndex }
			// The checkbox cell is drawn by Table.Row itself, so the row's own
			// checkbox is dressed as a placeholder block rather than left
			// looking selectable while there is nothing to select.
			className={ cn(
				'pointer-events-none',
				'[&>td:first-child_input]:!bg-misc-progress-background',
				'[&>td:first-child_input]:!border-none',
				'[&>td:first-child_input]:animate-pulse'
			) }
			aria-hidden="true"
		>
			{ cells.map( ( cell, cellIndex ) => (
				<Table.Cell
					key={ cellIndex }
					className={ cell.className }
					colSpan={ cell.colSpan }
				>
					{ cell.content }
				</Table.Cell>
			) ) }
		</Table.Row>
	) );

/**
 * A bar sized to one line of table text, so a cell of them stacks to the same
 * height as the text it stands in for: `md` matches text-sm (20px line box),
 * `sm` matches the text-xs second lines (16px).
 *
 * @param {Object} props
 * @param {string} props.width Tailwind width class for the bar.
 * @param {string} props.size  'md' for body text, 'sm' for the smaller lines.
 */
export const SkeletonLine = ( { width = 'w-32', size = 'md' } ) => (
	<span
		className={ cn( 'flex items-center', 'sm' === size ? 'h-4' : 'h-5' ) }
	>
		<Skeleton className={ cn( 'sm' === size ? 'h-2.5' : 'h-3', width ) } />
	</span>
);

/**
 * A bar shaped like the row's status toggle: 40x20, fully rounded.
 */
export const SkeletonToggle = () => (
	// inline-flex, not flex: the real Switch sits in the cell's line box, and
	// the 2px of descender space under it is part of the loaded row's height.
	<span className="inline-flex items-center">
		<Skeleton className="h-5 w-10 rounded-full" />
	</span>
);

/**
 * The row's action icons: square blocks on the right, sized like ghost
 * xs buttons and spaced the same.
 *
 * @param {Object} props
 * @param {number} props.count How many icon buttons the loaded row has.
 */
export const SkeletonActions = ( { count = 4 } ) => (
	<span className="flex justify-end items-center gap-2 h-6">
		{ Array.from( { length: count } ).map( ( _, index ) => (
			<Skeleton key={ index } className="size-6 rounded" />
		) ) }
	</span>
);

export default SkeletonRows;
