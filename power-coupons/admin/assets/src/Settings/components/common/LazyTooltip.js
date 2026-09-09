import { Tooltip } from '@bsf/force-ui';
import { useState, useRef, useEffect, cloneElement } from '@wordpress/element';

// The most recent trigger to mount because it was focused. Shared across every
// instance so that only the trigger the keyboard is actually on may reclaim
// focus: see the reclaim effect below.
let latestFocusClaim = 0;

/**
 * A tooltip that costs nothing until the pointer arrives.
 *
 * Every Force UI Tooltip sets up Floating UI on mount, so a table that puts a
 * few of them in each row pays for all of them on every render. With a hundred
 * rows that is hundreds of positioning contexts rebuilt whenever anything in
 * the table changes, which is what made ticking "select all" feel slow.
 *
 * The trigger renders bare until it is hovered or focused; only then does the
 * real tooltip mount, already open, so it still appears on that first hover.
 *
 * Use it anywhere a tooltip is repeated per row or per item. For a one-off
 * tooltip, Force UI's own is fine.
 *
 * @param {Object}  props
 * @param {string}  props.content    Tooltip text.
 * @param {Node}    props.children   The trigger. Must accept mouse and focus
 *                                   handlers and forward a ref, so a host
 *                                   element or a component that forwards both.
 * @param {Node}    props.portalRoot Element the tooltip portals into. Tailwind
 *                                   is scoped to the app root here, so a
 *                                   tooltip left on <body> renders unstyled.
 * @param {string}  props.placement  Force UI placement, defaults to top.
 * @param {boolean} props.arrow      Whether to draw the arrow.
 */
const LazyTooltip = ( {
	content,
	children,
	portalRoot,
	placement = 'top',
	arrow = true,
} ) => {
	const [ mounted, setMounted ] = useState( false );
	const [ open, setOpen ] = useState( false );
	const triggerRef = useRef( null );
	const openedByPointer = useRef( false );
	const focusClaim = useRef( 0 );

	const show = () => {
		setMounted( true );
		setOpen( true );
	};
	const hide = () => setOpen( false );

	/*
	 * Force UI clones the trigger with Floating UI's handlers spread last, so
	 * the ones attached below are gone the moment the real tooltip mounts.
	 * Sweeping quickly down a column of triggers leaves each one before that
	 * commit lands, so the enter is recorded but the leave reaches nothing, and
	 * the tooltip stays up until that trigger is hovered a second time —
	 * several rows' worth at once.
	 *
	 * Once mounted, Floating UI's own handlers close it correctly. Only the
	 * handover is lossy, so re-check the pointer there: if it has already moved
	 * on, close. Steady-state behaviour, safePolygon included, stays Floating
	 * UI's.
	 */
	/*
	 * Mounting re-parents the trigger inside the Tooltip, so React replaces
	 * its DOM node. When the tooltip was opened by focus, the node being
	 * replaced is the focused one, and focus falls to the body — tabbing
	 * through a row's actions lost the keyboard every other press. Put focus
	 * on the replacement node; the body check means focus is only ever
	 * reclaimed, never stolen from somewhere legitimate.
	 *
	 * "Body has focus" alone does not say which trigger lost it. Two Tabs
	 * inside one frame (key repeat on a long frame) mount two triggers, and
	 * the first one's frame would run first and pull focus backwards. Each
	 * focus-mount takes a claim, and only the latest claim may reclaim.
	 */
	useEffect( () => {
		if ( ! mounted || openedByPointer.current ) {
			return;
		}
		const claim = focusClaim.current;
		const frame = requestAnimationFrame( () => {
			const trigger = triggerRef.current;
			const doc = trigger?.ownerDocument;
			if (
				doc &&
				claim === latestFocusClaim &&
				doc.activeElement === doc.body
			) {
				trigger.focus( { preventScroll: true } );
			}
		} );
		return () => cancelAnimationFrame( frame );
	}, [ mounted ] );

	useEffect( () => {
		if ( ! mounted || ! openedByPointer.current ) {
			return;
		}
		// Next frame: :hover has not settled on the new tree yet this tick.
		const frame = requestAnimationFrame( () => {
			const trigger = triggerRef.current;
			if ( trigger && ! trigger.matches( ':hover' ) ) {
				setOpen( false );
			}
		} );
		return () => cancelAnimationFrame( frame );
	}, [ mounted, open ] );

	// The trigger may carry handlers of its own; keep them.
	const compose =
		( ours, theirs ) =>
		( ...args ) => {
			ours();
			theirs?.( ...args );
		};

	const trigger = cloneElement( children, {
		ref: triggerRef,
		onMouseEnter: compose( () => {
			openedByPointer.current = true;
			show();
		}, children.props.onMouseEnter ),
		onMouseLeave: compose( hide, children.props.onMouseLeave ),
		onFocus: compose( () => {
			openedByPointer.current = false;
			focusClaim.current = ++latestFocusClaim;
			show();
		}, children.props.onFocus ),
		onBlur: compose( hide, children.props.onBlur ),
	} );

	if ( ! mounted ) {
		return trigger;
	}

	return (
		<Tooltip
			content={ content }
			arrow={ arrow }
			placement={ placement }
			tooltipPortalRoot={ portalRoot }
			open={ open }
			setOpen={ setOpen }
		>
			{ trigger }
		</Tooltip>
	);
};

export default LazyTooltip;
