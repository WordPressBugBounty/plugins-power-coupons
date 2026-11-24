import { Badge, SearchBox } from '@bsf/force-ui';
import { __, sprintf } from '@wordpress/i18n';
import { useEffect, useState, useRef } from 'react';
import { fetchCategoriesByIds } from './categoryLookup';

const CategorySelector = ( {
	label,
	placeholder,
	value = [],
	onChange,
	inputId,
	labelledBy,
	disabled = false,
	// Inside a modal the list must portal into the modal, or it opens behind it.
	portalId = 'power-coupons-settings',
	error = false,
	describedBy,
} ) => {
	// Names known so far, by term ID. The selection itself always comes from
	// `value`, so a slow or failed name lookup can never drop a saved category,
	// and the merchant's order is kept.
	const [ categoryNames, setCategoryNames ] = useState( {} );
	const [ lookupFailed, setLookupFailed ] = useState( false );
	// IDs a lookup answered without (a deleted category, for example).
	const [ unresolvedIds, setUnresolvedIds ] = useState( {} );
	const [ searchTerm, setSearchTerm ] = useState( '' );
	const [ categories, setCategories ] = useState( [] );
	const [ loading, setLoading ] = useState( false );
	const [ searchFailed, setSearchFailed ] = useState( false );
	const [ open, setOpen ] = useState( false );
	const debounceRef = useRef( null );
	const latestSearch = useRef( 0 );
	const requestedIds = useRef( new Set() );

	// A malformed value must not white-screen the settings app.
	const selectedIds = ( Array.isArray( value ) ? value : [] )
		.map( Number )
		.filter( Boolean );

	const rememberNames = ( list ) => {
		setCategoryNames( ( previous ) => {
			const next = { ...previous };
			list.forEach( ( category ) => {
				next[ Number( category.id ) ] = category.name;
			} );
			return next;
		} );
	};

	// Look up names for selected IDs we have not seen yet (pre-filled values on edit).
	const missingIds = selectedIds.filter(
		( id ) => ! requestedIds.current.has( id )
	);
	const missingKey = missingIds.join( ',' );

	useEffect( () => {
		if ( ! missingIds.length ) {
			return;
		}

		missingIds.forEach( ( id ) => requestedIds.current.add( id ) );

		const requested = [ ...missingIds ];

		fetchCategoriesByIds( requested )
			.then( ( list ) => {
				rememberNames( list );

				const found = new Set(
					list.map( ( category ) => Number( category.id ) )
				);
				const notFound = requested.filter(
					( id ) => ! found.has( id )
				);

				if ( notFound.length ) {
					setUnresolvedIds( ( previous ) => {
						const next = { ...previous };
						notFound.forEach( ( id ) => {
							next[ id ] = true;
						} );
						return next;
					} );
				}
			} )
			.catch( ( lookupError ) => {
				console.error(
					'Error fetching categories by IDs:',
					lookupError
				);
				setLookupFailed( true );
			} );
	}, [ missingKey ] ); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		if ( debounceRef.current ) {
			clearTimeout( debounceRef.current );
		}

		if ( searchTerm.length > 1 ) {
			setLoading( true );
			debounceRef.current = setTimeout( () => {
				searchCategories( searchTerm );
				setOpen( true );
			}, 400 );
		} else {
			// Anything still in flight belongs to a term that is gone.
			latestSearch.current += 1;
			setLoading( false );
			setSearchFailed( false );
			setCategories( [] );
			setOpen( false );
		}

		return () => {
			if ( debounceRef.current ) {
				clearTimeout( debounceRef.current );
			}
		};
	}, [ searchTerm ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const searchCategories = async ( term ) => {
		// Only the newest request may update the list; an older, slower reply is ignored.
		const requestId = ++latestSearch.current;
		setLoading( true );
		setSearchFailed( false );

		let results = [];
		let failed = false;

		try {
			const nonce = window.powerCouponsSettings?.update_nonce;

			const formData = new FormData();
			formData.append( 'action', 'power_coupons_search_categories' );
			formData.append( 'term', term );
			formData.append( '_wpnonce', nonce || '' );

			const response = await fetch( ajaxurl, {
				method: 'POST',
				body: formData,
			} );
			const result = await response.json();

			if ( result.success && Array.isArray( result.data ) ) {
				results = result.data;
			} else {
				console.error( 'Search failed:', result );
				failed = true;
			}
		} catch ( searchError ) {
			console.error( 'Error searching categories:', searchError );
			failed = true;
		}

		if ( requestId !== latestSearch.current ) {
			return;
		}

		setCategories( results );
		setSearchFailed( failed );
		setLoading( false );
	};

	const addCategory = ( category ) => {
		const id = Number( category.id );

		if ( selectedIds.includes( id ) ) {
			return;
		}

		// The search result already carries the name, so the lookup effect must not fetch it again.
		requestedIds.current.add( id );
		rememberNames( [ category ] );
		onChange( [ ...selectedIds, id ] );
		setSearchTerm( '' );
		setOpen( false );
	};

	const removeCategory = ( categoryId ) => {
		if ( disabled ) {
			return;
		}
		onChange( selectedIds.filter( ( id ) => id !== categoryId ) );
	};

	const getCategoryLabel = ( id ) => {
		if ( categoryNames[ id ] ) {
			return categoryNames[ id ];
		}

		return lookupFailed || unresolvedIds[ id ]
			? sprintf(
					/* translators: %d: category ID. */
					__( 'Category #%d', 'power-coupons' ),
					id
			  )
			: `#${ id }`;
	};

	/* eslint-disable no-nested-ternary */
	const emptyMessage =
		searchTerm.length < 2
			? __( 'Type at least 2 letters to search', 'power-coupons' )
			: loading
			? __( 'Searching…', 'power-coupons' )
			: searchFailed
			? __(
					'Could not load categories. Please try again.',
					'power-coupons'
			  )
			: __( 'No categories found', 'power-coupons' );
	/* eslint-enable no-nested-ternary */

	return (
		<div className="flex flex-col gap-2">
			{ label && (
				<label className="text-sm font-medium" htmlFor={ inputId }>
					{ label }
				</label>
			) }

			<SearchBox
				variant="secondary"
				closeAfterSelect={ false }
				loading={ loading }
				setOpen={ setOpen }
				// A disabled row is `inert`, which older browsers ignore; the
				// control carries its own disabled state so it holds there too.
				open={ disabled ? false : open }
				size="md"
			>
				<SearchBox.Input
					disabled={ disabled }
					// The secondary variant only recolours text and outline when
					// disabled; the field background is what reads as "off".
					// The error colour is repeated for hover and focus-within so the
					// variant's own focus outline does not replace it, as in ProductSelector.
					className={ `w-full box-border [&_input]:min-w-0 [&_span]:hidden${
						error
							? ' outline-support-error hover:outline-support-error focus-within:outline-support-error focus-within:hover:outline-support-error'
							: ''
					}${ disabled ? ' bg-field-background-disabled' : '' }` }
					id={ inputId }
					aria-labelledby={ labelledBy }
					aria-invalid={ error ? 'true' : undefined }
					aria-describedby={ describedBy }
					placeholder={ placeholder }
					value={ searchTerm }
					onChange={ setSearchTerm }
				/>
				<SearchBox.Portal id={ portalId }>
					<SearchBox.Content>
						<SearchBox.List className="max-h-56 overflow-y-auto">
							{ categories.length > 0 ? (
								categories.map( ( category ) => {
									const isSelected = selectedIds.includes(
										Number( category.id )
									);
									return (
										<SearchBox.Item
											className={
												isSelected
													? 'opacity-50 cursor-not-allowed'
													: 'cursor-pointer'
											}
											key={ category.id }
											onClick={ () => {
												if ( ! isSelected ) {
													addCategory( category );
												}
											} }
										>
											{ category.name }
										</SearchBox.Item>
									);
								} )
							) : (
								<SearchBox.Empty>
									{ emptyMessage }
								</SearchBox.Empty>
							) }
						</SearchBox.List>
					</SearchBox.Content>
				</SearchBox.Portal>
			</SearchBox>

			{ selectedIds.length > 0 && (
				<div className="flex flex-wrap gap-2 mt-2">
					{ selectedIds.map( ( id ) => (
						<Badge
							closable
							disabled={ disabled }
							onClose={ () => removeCategory( id ) }
							key={ id }
							label={ getCategoryLabel( id ) }
							size="sm"
							type="pill"
							variant="neutral"
						/>
					) ) }
				</div>
			) }
		</div>
	);
};

export default CategorySelector;
