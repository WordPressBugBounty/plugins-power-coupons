import { SearchBox } from '@bsf/force-ui';
import { __ } from '@wordpress/i18n';
import { useEffect, useState, useRef } from 'react';

/**
 * Single-select, search-as-you-type page picker.
 *
 * Stores a single page ID (0 when nothing is selected). The selected page is
 * shown inside the search field itself: while a page is selected the input is
 * read-only and a clear (×) button is shown; clearing it returns the field to
 * its searchable state so a different page can be chosen.
 *
 * @param {Object}   props             Component props.
 * @param {string}   props.placeholder Input placeholder.
 * @param {number}   props.value       Currently selected page ID (0 = none).
 * @param {Function} props.onChange    Called with the selected page ID (or 0).
 * @param {string}   props.portalId    DOM id the dropdown portal renders into.
 * @param {string}   props.inputId     DOM id for the search input, so a caption
 *                                     outside this component can point a
 *                                     `<label for>` at it.
 * @param {string}   props.labelledBy  Id of the element naming this field.
 * @param {boolean}  props.disabled    Whether the control is disabled.
 * @return {JSX.Element} The page selector.
 */
const PageSelector = ( {
	placeholder,
	value = 0,
	onChange,
	portalId = 'power-coupons-settings',
	inputId,
	labelledBy,
	disabled = false,
} ) => {
	const [ selectedPage, setSelectedPage ] = useState( null );
	const [ searchTerm, setSearchTerm ] = useState( '' );
	const [ pages, setPages ] = useState( [] );
	const [ loading, setLoading ] = useState( false );
	const [ open, setOpen ] = useState( false );
	const debounceRef = useRef( null );

	// Pre-populate the selected page when a value is already saved.
	useEffect( () => {
		if ( value ) {
			fetchPageById( value );
		}
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		if ( debounceRef.current ) {
			clearTimeout( debounceRef.current );
		}

		if ( searchTerm.length > 2 ) {
			setLoading( true );
			debounceRef.current = setTimeout( () => {
				searchPages( searchTerm );
				setOpen( true );
			}, 400 );
		} else {
			setPages( [] );
			setOpen( false );
		}

		return () => {
			if ( debounceRef.current ) {
				clearTimeout( debounceRef.current );
			}
		};
	}, [ searchTerm ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const fetchPageById = async ( id ) => {
		try {
			const formData = new FormData();
			formData.append( 'action', 'power_coupons_get_pages_by_ids' );
			formData.append(
				'_wpnonce',
				window.powerCouponsSettings?.update_nonce || ''
			);
			formData.append( 'ids[0]', id );

			const response = await fetch( ajaxurl, {
				method: 'POST',
				body: formData,
			} );
			const result = await response.json();

			if ( result.success && result.data.length > 0 ) {
				setSelectedPage( result.data[ 0 ] );
			}
		} catch ( error ) {
			console.error( 'Error fetching page by ID:', error );
		}
	};

	const searchPages = async ( term ) => {
		setLoading( true );
		try {
			const nonce = window.powerCouponsSettings?.update_nonce;

			const formData = new FormData();
			formData.append( 'action', 'power_coupons_search_pages' );
			formData.append( 'term', term );
			formData.append( '_wpnonce', nonce || '' );

			const response = await fetch( ajaxurl, {
				method: 'POST',
				body: formData,
			} );
			const result = await response.json();

			if ( result.success ) {
				setPages( result.data );
			} else {
				console.error( 'Search failed:', result );
				setPages( [] );
			}
		} catch ( error ) {
			console.error( 'Error searching pages:', error );
			setPages( [] );
		}
		setLoading( false );
	};

	const selectPage = ( page ) => {
		setSelectedPage( page );
		onChange( page.id );
		setSearchTerm( '' );
		setPages( [] );
		setOpen( false );
	};

	const clearPage = () => {
		if ( disabled ) {
			return;
		}
		setSelectedPage( null );
		setSearchTerm( '' );
		setPages( [] );
		onChange( 0 );
	};

	const hasSelection = Boolean( selectedPage );

	return (
		<div className="relative">
			<SearchBox
				variant="secondary"
				closeAfterSelect={ false }
				loading={ loading }
				setOpen={ setOpen }
				// While a page is selected the field is read-only, so keep the
				// dropdown forced closed regardless of focus. Same when disabled:
				// the row is `inert`, which older browsers ignore, so the control
				// carries its own disabled state too.
				open={ hasSelection || disabled ? false : open }
				size="md"
			>
				<SearchBox.Input
					disabled={ disabled }
					// [&_span]:hidden removes the search icon and shortcut hint,
					// which the component exposes no prop for. The disabled
					// background is added by hand because the secondary variant
					// only recolours text and outline.
					className={ `w-[98%] [&_span]:hidden${
						disabled ? ' bg-field-background-disabled' : ''
					}` }
					id={ inputId }
					aria-labelledby={ labelledBy }
					placeholder={ placeholder }
					value={ hasSelection ? selectedPage.name : searchTerm }
					onChange={ setSearchTerm }
					readOnly={ hasSelection }
				/>
				<SearchBox.Portal id={ portalId }>
					<SearchBox.Content>
						<SearchBox.List>
							{ pages.length > 0 ? (
								pages.map( ( page ) => (
									<SearchBox.Item
										className="cursor-pointer"
										key={ page.id }
										onClick={ () => selectPage( page ) }
									>
										{ page.name }
									</SearchBox.Item>
								) )
							) : (
								<SearchBox.Empty>
									{ /* eslint-disable no-nested-ternary */ }
									{ searchTerm.length < 3
										? __(
												'Type at least 3 letters to search',
												'power-coupons'
										  )
										: loading
										? __( 'Searching…', 'power-coupons' )
										: __(
												'No pages found',
												'power-coupons'
										  ) }
									{ /* eslint-enable no-nested-ternary */ }
								</SearchBox.Empty>
							) }
						</SearchBox.List>
					</SearchBox.Content>
				</SearchBox.Portal>
			</SearchBox>

			{ hasSelection && (
				<button
					type="button"
					aria-label={ __( 'Clear selected page', 'power-coupons' ) }
					onClick={ clearPage }
					disabled={ disabled }
					className="absolute inset-y-0 right-3 z-20 my-auto flex h-5 w-5 items-center justify-center rounded-full border-0 bg-transparent p-0 text-text-secondary cursor-pointer hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-tertiary"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						className="h-4 w-4"
						aria-hidden="true"
					>
						<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
					</svg>
				</button>
			) }
		</div>
	);
};

export default PageSelector;
