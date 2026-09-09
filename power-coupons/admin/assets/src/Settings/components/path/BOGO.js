import { __, sprintf } from '@wordpress/i18n';
import {
	useState,
	useEffect,
	useRef,
	useCallback,
	useMemo,
	memo,
} from '@wordpress/element';
import bogoEnvelop from '../../../../images/bogo-envelop.svg';
import {
	actionLabel,
	createExcerpt,
	getBOGOPresetData,
	RenderIcon,
} from '../common/Utils';
import ModalCreateOffers from '../bogo/ModalCreateOffers';
import { Button, Container, Input, Switch, Table } from '@bsf/force-ui';
import {
	TrashIcon,
	PencilIcon,
	XMarkIcon,
	EyeIcon,
	DocumentDuplicateIcon,
	CheckIcon,
} from '@heroicons/react/24/outline';
import ConfirmationModal from '../common/ConfirmationModal';
import ModalPreviewOffer from '../bogo/ModalPreviewOffer';
import LazyTooltip from '../common/LazyTooltip';
import SkeletonRows, {
	SkeletonActions,
	SkeletonLine,
	SkeletonToggle,
} from '../common/TableSkeleton';

const features = [
	__(
		'Choose whether the reward is free, percentage-discounted, or fixed-price discounted.',
		'power-coupons'
	),
	__(
		'Offer the same product or different products as the free or discounted reward.',
		'power-coupons'
	),
	__(
		'Fully compatible with WooCommerce coupons, cart, and checkout experience.',
		'power-coupons'
	),
];

/**
 * One row of the offers table.
 *
 * Memoised, and handed callbacks that keep their identity across renders, so
 * selecting a single offer re-renders that row instead of the whole table.
 *
 * @param {Object} props
 */
const OfferRow = memo( function OfferRow( {
	offer,
	isSelected,
	isCloning,
	portalRoot,
	onSelectionChange,
	onEdit,
	onPreview,
	onClone,
	onDelete,
	onToggleStatus,
} ) {
	return (
		<Table.Row
			value={ offer }
			selected={ isSelected }
			onChangeSelection={ onSelectionChange }
		>
			{ /* The name is the row's subject, so it carries the primary
			     color and weight; every other cell stays secondary. */ }
			<Table.Cell className="text-sm">
				<button
					type="button"
					className="bg-transparent border-none p-0 m-0 cursor-pointer text-text-primary hover:text-wpcolor hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wpcolor rounded-sm text-sm font-normal text-left"
					onClick={ () => onEdit( offer.id ) }
				>
					{ createExcerpt( offer.name, 50, '…' ) }
				</button>
			</Table.Cell>
			{ /* Description and type are the widest, least scannable columns.
			     Below md they are dropped so name, status and the actions fit
			     the viewport instead of sitting behind a horizontal scroll. */ }
			<Table.Cell className="hidden md:table-cell text-text-secondary text-sm font-normal">
				{ createExcerpt( offer.description, 50, '…' ) }
			</Table.Cell>
			<Table.Cell className="hidden lg:table-cell text-text-secondary text-sm font-normal">
				{ getBOGOPresetData( offer.offer_type )?.title ||
					__( 'Custom', 'power-coupons' ) }
			</Table.Cell>
			<Table.Cell>
				<Switch
					aria-label={ sprintf(
						/* translators: %s: offer name */
						__( 'Enable %s', 'power-coupons' ),
						offer.name
					) }
					className="[&>input]:!border-none"
					defaultValue={ offer.status === 'active' }
					onChange={ ( checked ) =>
						onToggleStatus(
							offer.id,
							checked ? 'active' : 'inactive'
						)
					}
					size="sm"
				/>
			</Table.Cell>
			<Table.Cell>
				<Container
					align="center"
					className="gap-1 sm:gap-2"
					justify="end"
				>
					<LazyTooltip content="Preview" portalRoot={ portalRoot }>
						<Button
							onClick={ () => onPreview( offer ) }
							variant="ghost"
							icon={ <EyeIcon /> }
							size="xs"
							className="text-icon-secondary hover:text-icon-primary"
							aria-label={ actionLabel(
								__( 'Preview', 'power-coupons' ),
								offer.name
							) }
						/>
					</LazyTooltip>
					<LazyTooltip content="Edit" portalRoot={ portalRoot }>
						<Button
							onClick={ () => onEdit( offer.id ) }
							variant="ghost"
							icon={ <PencilIcon /> }
							size="xs"
							className="text-icon-secondary hover:text-icon-primary"
							aria-label={ actionLabel(
								__( 'Edit', 'power-coupons' ),
								offer.name
							) }
						/>
					</LazyTooltip>
					<LazyTooltip content="Clone" portalRoot={ portalRoot }>
						<Button
							onClick={ () => onClone( offer.id ) }
							variant="ghost"
							icon={ <DocumentDuplicateIcon /> }
							size="xs"
							className="text-icon-secondary hover:text-icon-primary"
							aria-label={ actionLabel(
								__( 'Clone', 'power-coupons' ),
								offer.name
							) }
							disabled={ isCloning }
						/>
					</LazyTooltip>
					<LazyTooltip content="Delete" portalRoot={ portalRoot }>
						<Button
							onClick={ () => onDelete( offer.id ) }
							variant="ghost"
							icon={ <TrashIcon /> }
							size="xs"
							className="text-icon-secondary hover:text-icon-primary"
							aria-label={ actionLabel(
								__( 'Delete', 'power-coupons' ),
								offer.name
							) }
						/>
					</LazyTooltip>
				</Container>
			</Table.Cell>
		</Table.Row>
	);
} );

function BOGO( { toast } ) {
	const [ openModal, setOpenModal ] = useState( false );
	const [ editingOffer, setEditingOffer ] = useState( null );
	const [ offers, setOffers ] = useState( [] );
	const [ loading, setLoading ] = useState( true );
	const [ searchQuery, setSearchQuery ] = useState( '' );
	const [ searching, setSearching ] = useState( false );

	const [ previewOffer, setPreviewOffer ] = useState( null );

	const [ isDeleting, setIsDeleting ] = useState( false );
	const [ deleteModal, setDeleteModal ] = useState( {
		isOpen: false,
		type: null,
		id: null,
	} );

	const debounceRef = useRef( null );
	const isFirstRender = useRef( true );
	const portalRootRef = useRef(
		document.getElementById( 'power-coupons-settings' )
	);

	const toggleModalOpen = ( displayToast, offerId = null ) => {
		document
			.querySelector( 'html' )
			.classList.toggle( 'power-coupon-modal-open' );

		// If offerId is provided, load the offer data for editing
		if ( offerId ) {
			const offerToEdit = offers.find(
				( offer ) => offer.id === offerId
			);
			setEditingOffer( offerToEdit );
		} else {
			setEditingOffer( null );
		}

		setOpenModal( ! openModal );

		if ( true === displayToast ) {
			toast.success(
				editingOffer
					? __( 'BOGO offer updated successfully!', 'power-coupons' )
					: __( 'BOGO offer created successfully!', 'power-coupons' ),
				{
					description: '',
				}
			);
		}
		loadOffers( true, searchQuery );
	};

	// Initial load on mount.
	useEffect( () => {
		loadOffers();
	}, [] );

	// Debounced server search whenever searchQuery changes.
	useEffect( () => {
		// Skip the very first render — initial load is handled by the effect above.
		if ( isFirstRender.current ) {
			isFirstRender.current = false;
			return;
		}

		// Signal that a search is in-progress immediately so the spinner shows.
		setSearching( true );
		setSelected( [] );

		// Clear any pending debounce timer.
		if ( debounceRef.current ) {
			clearTimeout( debounceRef.current );
		}

		debounceRef.current = setTimeout( () => {
			loadOffers( true, searchQuery );
		}, 400 );

		return () => {
			if ( debounceRef.current ) {
				clearTimeout( debounceRef.current );
			}
		};
	}, [ searchQuery ] ); // eslint-disable-line react-hooks/exhaustive-deps

	/**
	 * Load BOGO offers from the server.
	 *
	 * @param {boolean} silent When true, skip the full-table loading spinner.
	 * @param {string}  search Keyword to filter by (sent to the server).
	 */
	const loadOffers = async ( silent = false, search = '' ) => {
		if ( ! silent ) {
			setLoading( true );
		}

		try {
			const body = {
				action: 'power_coupons_get_bogo_offers',
				_wpnonce: window.powerCouponsSettings?.update_nonce || '',
			};

			if ( search.trim() ) {
				body.search = search.trim();
			}

			const response = await fetch( ajaxurl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams( body ),
			} );
			const result = await response.json();
			if ( result.success ) {
				setOffers( result.data || [] );
			}
		} catch ( error ) {
			console.error( 'Error loading offers:', error );
		}

		setLoading( false );
		setSearching( false );
	};

	const toggleOfferStatus = async ( offerId, newStatus ) => {
		try {
			const response = await fetch( ajaxurl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams( {
					action: 'power_coupons_toggle_bogo_status',
					_wpnonce: window.powerCouponsSettings?.update_nonce || '',
					offer_id: offerId,
					status: newStatus,
				} ),
			} );
			const result = await response.json();
			if ( result.success ) {
				loadOffers( true, searchQuery ); // Reload with current search.
				toast.success(
					newStatus === 'active'
						? __(
								'BOGO offer enabled successfully!',
								'power-coupons'
						  )
						: __(
								'BOGO offer disabled successfully!',
								'power-coupons'
						  ),
					{ description: '' }
				);
			}
		} catch ( error ) {
			console.error( 'Error toggling status:', error );
		}
	};

	const handleSingleDelete = async () => {
		setIsDeleting( true );
		try {
			const response = await fetch( ajaxurl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams( {
					action: 'power_coupons_delete_bogo_offer',
					_wpnonce: window.powerCouponsSettings?.update_nonce || '',
					offer_id: deleteModal.id,
				} ),
			} );
			const result = await response.json();
			if ( result.success ) {
				loadOffers( true, searchQuery );
				toast.success(
					__( 'BOGO offer deleted successfully!', 'power-coupons' ),
					{ description: '' }
				);
			}
		} catch ( error ) {
			console.error( 'Error deleting offer:', error );
		} finally {
			setIsDeleting( false );
			setDeleteModal( { isOpen: false, type: null, id: null } );
		}
	};

	const handleBulkDelete = async () => {
		setIsDeleting( true );
		try {
			const response = await fetch( ajaxurl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams( {
					action: 'power_coupons_bulk_delete_bogo_offers',
					_wpnonce: window.powerCouponsSettings?.update_nonce || '',
					offer_ids: JSON.stringify( selected ),
				} ),
			} );
			const result = await response.json();
			if ( result.success ) {
				setSelected( [] );
				loadOffers( true, searchQuery );
				toast.success(
					__( 'BOGO offers deleted successfully!', 'power-coupons' ),
					{ description: '' }
				);
			}
		} catch ( error ) {
			console.error( 'Error bulk deleting offers:', error );
		} finally {
			setIsDeleting( false );
			setDeleteModal( { isOpen: false, type: null, id: null } );
		}
	};

	const [ cloningId, setCloningId ] = useState( null );

	const handleCloneOffer = async ( offerId ) => {
		setCloningId( offerId );
		try {
			const response = await fetch( ajaxurl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams( {
					action: 'power_coupons_clone_bogo_offer',
					_wpnonce: window.powerCouponsSettings?.update_nonce || '',
					offer_id: offerId,
				} ),
			} );
			const result = await response.json();
			if ( result.success ) {
				loadOffers( true, searchQuery );
				toast.success(
					__( 'BOGO offer cloned successfully!', 'power-coupons' ),
					{ description: '' }
				);
			} else {
				toast.error(
					__(
						'Failed to clone offer. Please try again.',
						'power-coupons'
					),
					{ description: '' }
				);
			}
		} catch ( error ) {
			console.error( 'Error cloning offer:', error );
			toast.error(
				__(
					'Failed to clone offer. Please try again.',
					'power-coupons'
				),
				{ description: '' }
			);
		} finally {
			setCloningId( null );
		}
	};

	const [ selected, setSelected ] = useState( [] );

	// Membership is looked up once per row on every render, so keep it O(1).
	const selectedIds = useMemo( () => new Set( selected ), [ selected ] );

	const handleCheckboxChange = useCallback( ( checked, value ) => {
		setSelected( ( current ) =>
			checked
				? [ ...current, value.id ]
				: current.filter( ( item ) => item !== value.id )
		);
	}, [] );

	// Rows are memoised, so the callbacks they get have to keep their
	// identity. They read the current handlers through a ref rather than
	// closing over them, which would change on every render.
	const handlersRef = useRef( null );
	handlersRef.current = {
		toggleModalOpen,
		toggleOfferStatus,
		handleCloneOffer,
		setPreviewOffer,
		setDeleteModal,
	};

	const rowHandlers = useMemo(
		() => ( {
			onEdit: ( id ) => handlersRef.current.toggleModalOpen( false, id ),
			onPreview: ( offer ) =>
				handlersRef.current.setPreviewOffer( offer ),
			onClone: ( id ) => handlersRef.current.handleCloneOffer( id ),
			onDelete: ( id ) =>
				handlersRef.current.setDeleteModal( {
					isOpen: true,
					type: 'single',
					id,
				} ),
			onToggleStatus: ( id, status ) =>
				handlersRef.current.toggleOfferStatus( id, status ),
		} ),
		[]
	);

	const toggleSelectAll = ( checked ) => {
		if ( checked ) {
			setSelected( offers.map( ( item ) => item.id ) );
		} else {
			setSelected( [] );
		}
	};

	// Show empty state only when there truly are no offers (no active search).
	if (
		! loading &&
		! searching &&
		offers.length === 0 &&
		! searchQuery.trim()
	) {
		return (
			<>
				{ openModal && (
					<ModalCreateOffers
						toggleModalOpen={ toggleModalOpen }
						editingOffer={ editingOffer }
					/>
				) }

				{ /* Same card frame as the populated list, so arriving at the
				     first offer and returning to a full one read as one screen.
				     The card swaps in where skeleton rows were, so it rises the
				     one time it appears rather than snapping into place. */ }
				<div className="bg-background-primary rounded-xl border border-solid border-border-subtle p-8 md:p-10 animate-rise-in motion-reduce:animate-none">
					{ /* Capped and centred: left to fill the card, the copy and
					     the illustration end up 787px apart on a 1920 screen and
					     stop reading as one composition.

					     One grid, two arrangements. Stacked, the source order is
					     the reading order — headline, illustration, promise,
					     then the capabilities and the button. From lg the
					     illustration moves to a second column spanning both text
					     rows, so the copy is never squeezed by it, and the row
					     gap tightens to the 8px the headline and its paragraph
					     want once nothing sits between them. */ }
					<div className="mx-auto w-full max-w-[1040px] grid gap-x-12 gap-y-5 lg:gap-y-2 lg:grid-cols-[minmax(0,640px)_auto]">
						<h2 className="m-0 min-w-0 font-semibold text-2xl leading-8 text-text-primary lg:col-start-1 lg:row-start-1">
							{ __(
								"Let's Setup Your First BOGO Offer",
								'power-coupons'
							) }
						</h2>

						{ /* Decorative. width/height match the file's own 280x280
						     viewBox so the box is right before it paints.

						     The artwork only fills 226x197 of that box — inset
						     38px top and 46px bottom — so stacked it needs
						     negative margins to sit on the same optical rhythm
						     as the text instead of floating in its own padding.
						     The values are that inset scaled to each rendered
						     width; side by side from lg the box's padding stops
						     mattering, so they reset.

						     Left and right insets are within 1.4px of each
						     other, so centring the box centres the artwork. */ }
						<img
							src={ bogoEnvelop }
							alt=""
							aria-hidden="true"
							width="280"
							height="280"
							className="w-full max-w-[220px] sm:max-w-[260px] lg:w-[240px] lg:max-w-none xl:w-[300px] 2xl:w-[320px] h-auto shrink-0 select-none justify-self-center lg:justify-self-auto -mt-7 -mb-8 sm:-mt-8 sm:-mb-10 lg:m-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center"
						/>

						<div className="min-w-0 lg:col-start-1 lg:row-start-2">
							{ /* The promise is the supporting layer; the three
							     capabilities below it are the scannable facts
							     that decide whether to press the button, so
							     they carry the darker text. */ }
							<p className="m-0 max-w-prose text-sm leading-6 text-text-secondary">
								{ __(
									'Boost your sales and increase average order value by creating powerful Buy One Get One offers in your store. Reward customers automatically and drive conversions with flexible, fully customizable BOGO promotions.',
									'power-coupons'
								) }
							</p>

							{ /* eslint-disable-next-line jsx-a11y/no-redundant-roles */ }
							<ul
								role="list"
								className="list-none pl-0 mt-5 mb-0 space-y-2.5"
							>
								{ features.map( ( feature, index ) => (
									<li
										key={ feature + index }
										className="flex items-start gap-2.5 text-sm font-normal leading-6 text-text-primary"
									>
										{ /* Heroicons, like every other icon on
										     this screen — the shared RenderIcon
										     tick is an SVG string with an
										     off-palette #566A86 baked in. The
										     mt keeps it on the item's first
										     line when the text wraps. */ }
										<CheckIcon
											aria-hidden="true"
											className="shrink-0 mt-1 size-4 text-wpcolor"
											strokeWidth={ 2 }
										/>
										<span>{ feature }</span>
									</li>
								) ) }
							</ul>

							<Button
								variant="primary"
								size="md"
								tag="button"
								type="button"
								className="mt-8 whitespace-nowrap"
								icon={ RenderIcon( 'plus' ) }
								iconPosition="left"
								onClick={ toggleModalOpen }
							>
								{ __( 'Create New Offer', 'power-coupons' ) }
							</Button>
						</div>
					</div>
				</div>
			</>
		);
	}

	const handleConfirmDelete = () => {
		if ( deleteModal.type === 'bulk' ) {
			handleBulkDelete();
		} else {
			handleSingleDelete();
		}
	};

	const handleCancelSelect = () => {
		setSelected( [] );
	};

	// Handle delete trigger.
	const handleDeleteTrigger = () => {
		if ( ! selected.length ) {
			return;
		}
		setDeleteModal( { isOpen: true, type: 'bulk', id: null } );
	};

	// Show offers table
	return (
		<>
			{ openModal && (
				<ModalCreateOffers
					toggleModalOpen={ toggleModalOpen }
					editingOffer={ editingOffer }
				/>
			) }

			{ /* border-solid is explicit: Tailwind's preflight border-style
			     reset does not win here, so a bare `border` computes to
			     `0px none` and the card edge never renders. */ }
			<div className="bg-background-primary rounded-xl border border-solid border-border-subtle p-4 flex flex-col gap-4">
				{ /* Header */ }
				<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
					<div className="flex items-center gap-4">
						<h2 className="m-0 text-xl font-semibold text-text-primary">
							{ __( 'BOGO Offers', 'power-coupons' ) }
						</h2>

						{ ! loading && selected.length > 0 && (
							<div className="flex gap-4 pl-4 items-center border-0 border-l border-solid border-border-subtle">
								<Button
									variant="ghost"
									icon={
										<XMarkIcon className="h-6 w-6 text-field-placeholder" />
									}
									size="xs"
									className="text-icon-secondary hover:text-icon-primary"
									onClick={ handleCancelSelect }
								/>
								<span className="text-sm font-normal text-field-placeholder whitespace-nowrap">
									{ selected.length }{ ' ' }
									{ __( 'Selected', 'power-coupons' ) }
								</span>
								<Button
									className="py-2 px-4 bg-badge-background-red text-support-error outline-support-error hover:bg-badge-background-red hover:outline-support-error"
									size="sm"
									tag="button"
									type="button"
									variant="outline"
									icon={ <TrashIcon className="h-4 w-4" /> }
									iconPosition="left"
									onClick={ handleDeleteTrigger }
								>
									{ __( 'Delete', 'power-coupons' ) }
								</Button>
							</div>
						) }
					</div>
					<div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
						<div className="flex-1 sm:flex-none sm:w-64">
							<Input
								type="search"
								size="sm"
								className="[&_input]:h-8 [&_input]:min-h-0 [&_input]:py-0"
								value={ searchQuery }
								onChange={ setSearchQuery }
								placeholder={ __(
									'Search offers…',
									'power-coupons'
								) }
								prefix={
									searching ? (
										<svg
											className="h-4 w-4 animate-spin"
											viewBox="0 0 100 100"
										>
											<circle
												fill="none"
												strokeWidth="10"
												className="stroke-current opacity-40"
												cx="50"
												cy="50"
												r="40"
											></circle>
											<circle
												fill="none"
												strokeWidth="10"
												className="stroke-current"
												strokeDasharray="250"
												strokeDashoffset="210"
												cx="50"
												cy="50"
												r="40"
											></circle>
										</svg>
									) : (
										<span className="flex text-field-placeholder">
											{ RenderIcon( 'search' ) }
										</span>
									)
								}
							/>
						</div>
						<Button
							variant="primary"
							size="sm"
							tag="button"
							type="button"
							className="whitespace-nowrap"
							icon={ RenderIcon( 'plus' ) }
							iconPosition="left"
							onClick={ toggleModalOpen }
						>
							{ __( 'Create New Offer', 'power-coupons' ) }
						</Button>
					</div>
				</div>

				{ /* Table */ }
				<div>
					{ /* Offer names wrap rather than forcing the table wider than
					     the viewport; only the status and action columns, which
					     have no wrap point, are held on one line. Cell padding
					     tightens below sm so the four row actions still land
					     inside a 390px screen. */ }
					<Table
						checkboxSelection={ loading || offers.length > 0 }
						className="whitespace-normal [&_td:nth-last-child(-n+2)]:whitespace-nowrap [&_th:nth-last-child(-n+2)]:whitespace-nowrap [&_td]:px-2 [&_th:not(:first-child)]:px-2 sm:[&_td]:px-3 sm:[&_th:not(:first-child)]:px-3 [&_th:first-child]:box-border [&_td:first-child]:box-border [&_tbody_tr:not(.bg-background-secondary):hover]:bg-misc-dropdown-hover [&_tbody_tr.bg-background-secondary]:bg-wphovercolorfaded"
					>
						<Table.Head
							selected={ selected.length > 0 }
							onChangeSelection={ toggleSelectAll }
							indeterminate={
								selected.length > 0 &&
								selected.length < offers.length
							}
						>
							<Table.HeadCell>
								{ __( 'Offer Name', 'power-coupons' ) }
							</Table.HeadCell>
							<Table.HeadCell className="hidden md:table-cell">
								{ __( 'Description', 'power-coupons' ) }
							</Table.HeadCell>
							<Table.HeadCell className="hidden lg:table-cell">
								{ __( 'Offer Type', 'power-coupons' ) }
							</Table.HeadCell>
							<Table.HeadCell>
								{ __( 'Status', 'power-coupons' ) }
							</Table.HeadCell>
							<Table.HeadCell>
								<Container
									align="center"
									className="gap-2"
									justify="end"
								>
									{ __( 'Actions', 'power-coupons' ) }
								</Container>
							</Table.HeadCell>
						</Table.Head>
						<Table.Body aria-busy={ loading }>
							{ loading && (
								<SkeletonRows
									cells={ [
										{
											className:
												'text-text-secondary text-sm font-normal',
											content: (
												<SkeletonLine width="w-56" />
											),
										},
										{
											className:
												'hidden md:table-cell text-text-secondary text-sm font-normal',
											content: (
												<SkeletonLine width="w-72" />
											),
										},
										{
											className:
												'hidden lg:table-cell text-text-secondary text-sm font-normal',
											content: (
												<SkeletonLine width="w-40" />
											),
										},
										{ content: <SkeletonToggle /> },
										{
											content: (
												<SkeletonActions count={ 4 } />
											),
										},
									] }
								/>
							) }
							{ ! loading && 0 === offers.length && (
								<Table.Row>
									<Table.Cell
										colSpan={ 5 }
										className="w-full text-center text-text-tertiary py-8"
									>
										{ __(
											'No offers found matching your search.',
											'power-coupons'
										) }
									</Table.Cell>
								</Table.Row>
							) }
							{ ! loading &&
								offers.map( ( offer ) => (
									<OfferRow
										key={ offer.id }
										offer={ offer }
										isSelected={ selectedIds.has(
											offer.id
										) }
										isCloning={ cloningId === offer.id }
										portalRoot={ portalRootRef.current }
										onSelectionChange={
											handleCheckboxChange
										}
										{ ...rowHandlers }
									/>
								) ) }
						</Table.Body>
					</Table>
				</div>
			</div>

			{ previewOffer && (
				<ModalPreviewOffer
					offer={ previewOffer }
					onClose={ () => setPreviewOffer( null ) }
				/>
			) }

			<ConfirmationModal
				isOpen={ deleteModal.isOpen }
				onClose={ () =>
					setDeleteModal( {
						isOpen: false,
						type: null,
						id: null,
					} )
				}
				onConfirm={ handleConfirmDelete }
				title={
					/* eslint-disable no-mixed-spaces-and-tabs, indent, @wordpress/i18n-no-variables, @wordpress/i18n-no-collapsible-whitespace, @wordpress/i18n-translator-comments */
					deleteModal.type === 'bulk'
						? __( 'Delete Selected Offers', 'power-coupons' )
						: __( 'Delete Offer', 'power-coupons' )
				}
				message={
					deleteModal.type === 'bulk'
						? sprintf(
								/* translators: %s: number of selected offers */
								__(
									'Are you sure you want to delete %s selected offer(s)? This action cannot be undone.',
									'power-coupons'
								),
								selected.length
						  )
						: __(
								'Are you sure you want to delete this offer? This action cannot be undone.',
								'power-coupons'
						  )
				}
				isLoading={ isDeleting }
			/>
		</>
	);
}

export default BOGO;
