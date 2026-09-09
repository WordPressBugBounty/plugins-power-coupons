import { useEffect, useRef } from '@wordpress/element';

// What Tab can land on. Kept deliberately simple: everything this app puts in
// a dialog is a link, form control, or explicitly tab-indexed element.
const TABBABLE_SELECTOR =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Something open inside the dialog that owns the next Escape, and closes on it
// by itself. Force UI's Select marks its button aria-expanded while its list is
// up; its SearchBox renders no such state, but Floating UI's focus manager puts
// a pair of focus-guard spans in the results portal for exactly as long as the
// list is open; the wizards' date pickers are the app's own popup. While any of
// these is open, Escape closes it and the dialog stays.
const INNER_LAYER_SELECTOR =
	'[aria-expanded="true"], [role="listbox"], [data-floating-ui-focus-guard], .pc-date-picker-popup';

// The React root. Everything the dialog covers lives under it, so this is how
// far the inert sweep climbs. Falls back to <body> outside the settings app.
const APP_ROOT_SELECTOR = '#power-coupons-settings';

const isVisible = ( el ) => el.getClientRects().length > 0;

const tabbablesIn = ( root ) =>
	[ ...root.querySelectorAll( TABBABLE_SELECTOR ) ].filter( isVisible );

/*
 * aria-modal promises that nothing outside the dialog exists, but the page
 * underneath stays mounted, so a screen reader's virtual cursor could still
 * reach and activate it. Marking every sibling along the dialog's ancestor
 * chain `inert` — up to the app root — takes them out of the accessibility
 * tree and out of focus order for as long as the dialog is open. Only nodes
 * this call marked are unmarked on the way out.
 */
const hideOutside = ( container ) => {
	const boundary =
		container.closest( APP_ROOT_SELECTOR ) || container.ownerDocument.body;
	const marked = [];
	let node = container;
	while ( node && node !== boundary ) {
		const parent = node.parentElement;
		if ( ! parent ) {
			break;
		}
		for ( const sibling of parent.children ) {
			if ( sibling !== node && ! sibling.hasAttribute( 'inert' ) ) {
				sibling.setAttribute( 'inert', '' );
				marked.push( sibling );
			}
		}
		node = parent;
	}
	return () => marked.forEach( ( el ) => el.removeAttribute( 'inert' ) );
};

/**
 * Make a region behave like a modal dialog while it is open.
 *
 * The wizards and the Manual Adjust panel all declare aria-modal but render on
 * top of a page that stays mounted, so without this a Tab press walks straight
 * out of the dialog into controls the overlay is covering, and a screen reader
 * can still read the page behind.
 *
 * While active:
 * - Tab and Shift+Tab wrap at the edges of the container. A press that finds
 *   focus on the container itself, or already outside it, is treated as an
 *   edge and pulled to the nearest end.
 * - Escape calls `onEscape`, unless a list or picker inside the dialog is open
 *   — that one closes first and the dialog stays.
 * - Everything the dialog covers, up to the app root, is `inert`.
 * - With `manageFocus`, opening moves focus into the container and closing
 *   returns it to the opener.
 *
 * @param {Object}   containerRef         React ref to the dialog element, or a
 *                                        wrapper around it. May be unset on the
 *                                        first tick; it is read lazily.
 * @param {Object}   options
 * @param {boolean}  options.active       Whether the dialog is open. Defaults
 *                                        to true.
 * @param {boolean}  options.manageFocus  Move focus in on open and back to the
 *                                        opener on close. Defaults to true.
 * @param {string}   options.initialFocus Selector, inside the container, for
 *                                        where focus should land on open: that
 *                                        element if it is tabbable, otherwise
 *                                        the first tabbable inside it. Without
 *                                        it the container itself takes focus,
 *                                        so the dialog's own name is read.
 * @param {Object}   options.opener       Ref to the element focus returns to on
 *                                        close. Defaults to whatever had focus
 *                                        when the dialog opened, which Safari
 *                                        and Firefox do not set on a mouse
 *                                        click of a button.
 * @param {Function} options.onEscape     Called when Escape should close the
 *                                        dialog. Omit for a dialog Escape must
 *                                        not close.
 */
const useModalFocus = (
	containerRef,
	{
		active = true,
		manageFocus = true,
		initialFocus = null,
		opener = null,
		onEscape = null,
	} = {}
) => {
	// Read at event time, so a fresh closure each render does not restart the
	// effect — which would re-run the focus move on every keystroke.
	const onEscapeRef = useRef( onEscape );
	onEscapeRef.current = onEscape;

	useEffect( () => {
		if ( ! active ) {
			return;
		}
		const doc =
			containerRef.current?.ownerDocument ||
			// eslint-disable-next-line @wordpress/no-global-active-element -- fallback for the pre-mount tick; re-read from the ref below.
			document;
		const previouslyFocused = manageFocus ? doc.activeElement : null;
		// The opener is recorded before the dialog opens, so it is settled by
		// now; read it here rather than in the cleanup, after it may have gone.
		const openerElement = opener?.current || null;

		let unhide = null;
		// Next frame: the container's contents mount after this tick.
		const frame = requestAnimationFrame( () => {
			const container = containerRef.current;
			if ( ! container ) {
				return;
			}
			unhide = hideOutside( container );
			if ( ! manageFocus ) {
				return;
			}
			const current = doc.activeElement;
			if ( container.contains( current ) && current !== container ) {
				return;
			}
			const region = initialFocus
				? container.querySelector( initialFocus )
				: null;
			let target = container;
			if ( region ) {
				target = region.matches( TABBABLE_SELECTOR )
					? region
					: tabbablesIn( region )[ 0 ] || container;
			}
			target.focus( { preventScroll: true } );
		} );

		const handleKeydown = ( event ) => {
			const container = containerRef.current;
			if ( ! container ) {
				return;
			}
			if ( 'Escape' === event.key ) {
				if (
					! onEscapeRef.current ||
					event.defaultPrevented ||
					event.isComposing ||
					container.querySelector( INNER_LAYER_SELECTOR )
				) {
					return;
				}
				event.preventDefault();
				onEscapeRef.current( event );
				return;
			}
			if ( 'Tab' !== event.key ) {
				return;
			}
			const tabbables = tabbablesIn( container );
			if ( ! tabbables.length ) {
				event.preventDefault();
				return;
			}
			const first = tabbables[ 0 ];
			const last = tabbables[ tabbables.length - 1 ];
			const current = doc.activeElement;
			// The container itself counts as an edge: focus parks there on
			// open, and Node.contains() is true for the node itself, so it
			// would otherwise pass as "inside" and Shift+Tab would walk out.
			const atEdge =
				current === container || ! container.contains( current );
			if ( event.shiftKey ) {
				if ( current === first || atEdge ) {
					event.preventDefault();
					last.focus();
				}
			} else if ( current === last || atEdge ) {
				event.preventDefault();
				first.focus();
			}
		};
		doc.addEventListener( 'keydown', handleKeydown, true );

		return () => {
			doc.removeEventListener( 'keydown', handleKeydown, true );
			cancelAnimationFrame( frame );
			unhide?.();
			if ( ! manageFocus ) {
				return;
			}
			const target = [ openerElement, previouslyFocused ].find(
				( el ) => el && el.isConnected && el !== doc.body
			);
			target?.focus( { preventScroll: true } );
		};
	}, [ containerRef, active, manageFocus, initialFocus, opener ] );
};

export default useModalFocus;
