import { __, sprintf } from '@wordpress/i18n';
import { useState, useEffect, useRef } from '@wordpress/element';
import { Button, Container, Input, Switch, Table } from '@bsf/force-ui';
import {
	TrashIcon,
	PencilIcon,
	XMarkIcon,
	ShoppingBagIcon,
	UserPlusIcon,
	ChatBubbleBottomCenterTextIcon,
	InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { RenderIcon, actionLabel } from '../common/Utils';
import ConfirmationModal from '../common/ConfirmationModal';
import LazyTooltip from '../common/LazyTooltip';
import LoyaltyStatusPill from './LoyaltyStatusPill';
import ModalCreateCampaign from './ModalCreateCampaign';
import SkeletonRows, {
	SkeletonActions,
	SkeletonLine,
	SkeletonToggle,
} from '../common/TableSkeleton';

const ACTION_TYPE_LABELS = {
	order_earn: __( 'Order Earning', 'power-coupons' ),
	signup: __( 'Signup Bonus', 'power-coupons' ),
	review: __( 'Product Review', 'power-coupons' ),
};

const PROGRAM_TYPE_CARDS = [
	{
		key: 'order_earn',
		Icon: ShoppingBagIcon,
		label: __( 'Order Earning', 'power-coupons' ),
		description: __(
			'Award credits when a customer completes an order.',
			'power-coupons'
		),
		example: __( 'e.g. 2 credits per $1 spent.', 'power-coupons' ),
	},
	{
		key: 'signup',
		Icon: UserPlusIcon,
		label: __( 'Signup Bonus', 'power-coupons' ),
		description: __(
			'Award credits once when a new user registers.',
			'power-coupons'
		),
		example: __( 'e.g. 100 credits on signup.', 'power-coupons' ),
	},
	{
		key: 'review',
		Icon: ChatBubbleBottomCenterTextIcon,
		label: __( 'Product Review', 'power-coupons' ),
		description: __(
			'Award credits when a customer leaves an approved product review.',
			'power-coupons'
		),
		example: __( 'e.g. 50 credits per review.', 'power-coupons' ),
	},
];

const EARN_TYPE_LABELS = {
	fixed: __( 'Fixed', 'power-coupons' ),
	per_currency: __( 'Per Currency Unit', 'power-coupons' ),
	percentage: __( 'Percentage', 'power-coupons' ),
};

const EARN_TYPE_DESCRIPTIONS = {
	fixed: __(
		'A fixed number of credits awarded per order, regardless of cart total.',
		'power-coupons'
	),
	per_currency: __(
		'Credits based on amount spent. E.g., "100" means 100 credits earned per $1 spent.',
		'power-coupons'
	),
	percentage: __(
		'Credits as a percentage of the order total. E.g., "10" means 10 credits per $10 spent.',
		'power-coupons'
	),
};

function CampaignsList( { toast, tabSelector } ) {
	const [ openModal, setOpenModal ] = useState( false );
	const [ editingCampaign, setEditingCampaign ] = useState( null );
	const [ campaigns, setCampaigns ] = useState( [] );
	const [ loading, setLoading ] = useState( true );
	const [ searchQuery, setSearchQuery ] = useState( '' );
	const [ searching, setSearching ] = useState( false );
	const [ selected, setSelected ] = useState( [] );

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

	const getNonce = () =>
		window.powerCouponsSettings?.points_nonces?.campaigns || '';

	const toggleModalOpen = ( displayToast = false, campaignId = null ) => {
		document
			.querySelector( 'html' )
			.classList.toggle( 'power-coupon-modal-open' );

		// Compute toast message before updating state to avoid stale reference.
		const isEditing = !! editingCampaign;

		if ( campaignId ) {
			const campaignToEdit = campaigns.find(
				( c ) => c.id === campaignId
			);
			setEditingCampaign( campaignToEdit );
		} else {
			setEditingCampaign( null );
		}

		setOpenModal( ( prev ) => ! prev );

		if ( true === displayToast ) {
			const toastMessage = isEditing
				? __( 'Campaign updated successfully!', 'power-coupons' )
				: __( 'Campaign created successfully!', 'power-coupons' );
			toast.success( toastMessage, { description: '' } );
		}
		loadCampaigns( true, searchQuery );
	};

	// Initial load on mount.
	useEffect( () => {
		loadCampaigns();
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	// Debounced server search whenever searchQuery changes.
	useEffect( () => {
		if ( isFirstRender.current ) {
			isFirstRender.current = false;
			return;
		}

		setSearching( true );
		setSelected( [] );

		if ( debounceRef.current ) {
			clearTimeout( debounceRef.current );
		}

		debounceRef.current = setTimeout( () => {
			loadCampaigns( true, searchQuery );
		}, 400 );

		return () => {
			if ( debounceRef.current ) {
				clearTimeout( debounceRef.current );
			}
		};
	}, [ searchQuery ] ); // eslint-disable-line react-hooks/exhaustive-deps

	/**
	 * Load campaigns from the server.
	 *
	 * @param {boolean} silent When true, skip the full-table loading spinner.
	 * @param {string}  search Keyword to filter by (sent to the server).
	 */
	const loadCampaigns = async ( silent = false, search = '' ) => {
		if ( ! silent ) {
			setLoading( true );
		}

		try {
			const body = {
				action: 'power_coupons_get_points_campaigns',
				_wpnonce: getNonce(),
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
				setCampaigns( result.data?.campaigns || [] );
			}
		} catch ( error ) {
			console.error( 'Error loading campaigns:', error );
		}

		setLoading( false );
		setSearching( false );
	};

	const toggleCampaignStatus = async ( campaignId, newStatus ) => {
		try {
			const response = await fetch( ajaxurl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams( {
					action: 'power_coupons_toggle_points_campaign_status',
					_wpnonce: getNonce(),
					campaign_id: campaignId,
					status: newStatus,
				} ),
			} );
			const result = await response.json();
			if ( result.success ) {
				loadCampaigns( true, searchQuery );
				toast.success(
					newStatus === 'active'
						? __(
								'Campaign enabled successfully!',
								'power-coupons'
						  )
						: __(
								'Campaign disabled successfully!',
								'power-coupons'
						  ),
					{ description: '' }
				);
			}
		} catch ( error ) {
			console.error( 'Error toggling campaign status:', error );
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
					action: 'power_coupons_delete_points_campaign',
					_wpnonce: getNonce(),
					campaign_id: deleteModal.id,
				} ),
			} );
			const result = await response.json();
			if ( result.success ) {
				loadCampaigns( true, searchQuery );
				toast.success(
					__( 'Campaign deleted successfully!', 'power-coupons' ),
					{ description: '' }
				);
			}
		} catch ( error ) {
			console.error( 'Error deleting campaign:', error );
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
					action: 'power_coupons_bulk_delete_points_campaigns',
					_wpnonce: getNonce(),
					campaign_ids: JSON.stringify( selected ),
				} ),
			} );
			const result = await response.json();
			if ( result.success ) {
				setSelected( [] );
				loadCampaigns( true, searchQuery );
				toast.success(
					__( 'Campaigns deleted successfully!', 'power-coupons' ),
					{ description: '' }
				);
			}
		} catch ( error ) {
			console.error( 'Error bulk deleting campaigns:', error );
		} finally {
			setIsDeleting( false );
			setDeleteModal( { isOpen: false, type: null, id: null } );
		}
	};

	const handleCheckboxChange = ( checked, value ) => {
		if ( checked ) {
			setSelected( [ ...selected, value.id ] );
		} else {
			setSelected( selected.filter( ( item ) => item !== value.id ) );
		}
	};

	const toggleSelectAll = ( checked ) => {
		if ( checked ) {
			setSelected( campaigns.map( ( item ) => item.id ) );
		} else {
			setSelected( [] );
		}
	};

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

	const handleDeleteTrigger = () => {
		if ( ! selected.length ) {
			return;
		}
		setDeleteModal( { isOpen: true, type: 'bulk', id: null } );
	};

	const renderEarnType = ( campaign ) => {
		if ( campaign.action_type !== 'order_earn' ) {
			return __( '-', 'power-coupons' );
		}

		const label =
			EARN_TYPE_LABELS[ campaign.earn_type ] ||
			campaign.earn_type ||
			__( '-', 'power-coupons' );

		if ( EARN_TYPE_DESCRIPTIONS[ campaign.earn_type ] ) {
			return (
				<LazyTooltip
					content={ EARN_TYPE_DESCRIPTIONS[ campaign.earn_type ] }
					placement="top"
					portalRoot={ portalRootRef.current }
				>
					<span className="cursor-help">{ label }</span>
				</LazyTooltip>
			);
		}

		return label;
	};

	// Show empty state only when there truly are no campaigns (no active search).
	if (
		! loading &&
		! searching &&
		campaigns.length === 0 &&
		! searchQuery.trim()
	) {
		return (
			<>
				{ openModal && (
					<ModalCreateCampaign
						toggleModalOpen={ toggleModalOpen }
						editingCampaign={ editingCampaign }
					/>
				) }

				{ /* border-solid is explicit: Tailwind's preflight border-style
				     reset does not win here, so a bare `border` computes to
				     `0px none` and the card edge never renders. */ }
				<div className="bg-background-primary rounded-xl border border-solid border-border-subtle p-8 flex flex-col items-center text-center">
					<div className="self-start">{ tabSelector }</div>

					{ /* Spacing is set per child rather than by one container gap:
					     the headline needs more room above it than below, and its
					     promise belongs to it. */ }
					<h2 className="m-0 mt-8 font-semibold text-2xl leading-8 text-text-primary">
						{ __(
							'Create Your First Credits Campaign',
							'power-coupons'
						) }
					</h2>
					<p className="m-0 mt-2 max-w-xl text-sm leading-6 text-text-secondary">
						{ __(
							'Reward customers with credits they can redeem for discounts. Choose from the program types below, and run as many as you like at once.',
							'power-coupons'
						) }
					</p>

					<div
						className="grid w-full max-w-3xl grid-cols-1 sm:grid-cols-3 gap-4 mt-7"
						aria-label={ __(
							'Available reward program types',
							'power-coupons'
						) }
					>
						{ PROGRAM_TYPE_CARDS.map( ( card ) => (
							<div
								key={ card.key }
								className="flex flex-col items-start gap-1 p-4 rounded-lg border border-solid border-border-subtle bg-field-primary-background text-left"
							>
								{ /* The brand orange reads 2.8:1 on this tint —
								     under the 3:1 floor a glyph needs — so the
								     chip carries the darker end of the ramp. */ }
								<div className="inline-flex items-center justify-center h-9 w-9 mb-2 rounded-md bg-wpcolorfaded text-wphovercolor">
									<card.Icon
										aria-hidden="true"
										className="h-5 w-5"
									/>
								</div>
								<strong className="text-sm font-semibold leading-5 text-text-primary">
									{ card.label }
								</strong>
								<p className="m-0 text-xs leading-5 text-text-secondary">
									{ card.description }
								</p>
								{ /* Quieter than the description by spacing and by its
								     own "e.g." wording, not by a lighter grey: the
								     tertiary token reads 2.5:1 on this panel. */ }
								<p className="m-0 mt-0.5 text-xs leading-5 text-text-secondary">
									{ card.example }
								</p>
							</div>
						) ) }
					</div>

					<Button
						variant="primary"
						size="md"
						tag="button"
						type="button"
						className="mt-8 whitespace-nowrap"
						icon={ RenderIcon( 'plus' ) }
						iconPosition="left"
						onClick={ () => toggleModalOpen() }
					>
						{ __( 'Create New Campaign', 'power-coupons' ) }
					</Button>
				</div>
			</>
		);
	}

	return (
		<>
			{ openModal && (
				<ModalCreateCampaign
					toggleModalOpen={ toggleModalOpen }
					editingCampaign={ editingCampaign }
				/>
			) }

			{ /* border-solid is explicit: Tailwind's preflight border-style
			     reset does not win here, so a bare `border` computes to
			     `0px none` and the card edge never renders. */ }
			<div className="bg-background-primary rounded-xl border border-solid border-border-subtle p-4 flex flex-col gap-4">
				<div className="flex items-center gap-2 flex-wrap">
					<h2 className="m-0 text-xl font-semibold text-text-primary">
						{ __( 'Loyalty Rewards', 'power-coupons' ) }
					</h2>
					<LoyaltyStatusPill />
				</div>
				{ /* Header */ }
				<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
					<div className="flex items-center gap-4">
						{ tabSelector }

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
									'Search campaigns…',
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
							onClick={ () => toggleModalOpen() }
						>
							{ __( 'Create New Campaign', 'power-coupons' ) }
						</Button>
					</div>
				</div>

				{ campaigns.length > 0 && (
					<div className="flex items-start gap-2 px-3 py-2 rounded-md bg-badge-background-sky text-badge-color-sky text-xs leading-snug">
						<InformationCircleIcon
							aria-hidden="true"
							className="h-4 w-4 mt-0.5 text-badge-color-sky flex-shrink-0"
						/>
						<p className="m-0">
							{ __(
								'You can run multiple campaigns simultaneously. Priority decides which one wins when more than one matches.',
								'power-coupons'
							) }
						</p>
					</div>
				) }

				{ /* Table */ }
				<div>
					{ /* Campaign names wrap rather than forcing the table wider
					     than the viewport; only the status and action columns,
					     which have no wrap point, are held on one line. Cell
					     padding tightens below sm, and the checkbox column is
					     box-sized so its padding fits the 44px it asks for
					     instead of adding to it. */ }
					<Table
						checkboxSelection={ loading || campaigns.length > 0 }
						className="whitespace-normal [&_td:nth-last-child(-n+2)]:whitespace-nowrap [&_th:nth-last-child(-n+2)]:whitespace-nowrap [&_td]:px-2 [&_th:not(:first-child)]:px-2 sm:[&_td]:px-3 sm:[&_th:not(:first-child)]:px-3 [&_th:first-child]:box-border [&_td:first-child]:box-border [&_tbody_tr:not(.bg-background-secondary):hover]:bg-misc-dropdown-hover [&_tbody_tr.bg-background-secondary]:bg-wphovercolorfaded"
					>
						<Table.Head
							selected={ selected.length > 0 }
							onChangeSelection={ toggleSelectAll }
							indeterminate={
								selected.length > 0 &&
								selected.length < campaigns.length
							}
						>
							<Table.HeadCell>
								{ __( 'Title', 'power-coupons' ) }
							</Table.HeadCell>
							<Table.HeadCell className="hidden md:table-cell">
								{ __( 'Action Type', 'power-coupons' ) }
							</Table.HeadCell>
							<Table.HeadCell className="hidden lg:table-cell">
								{ __( 'Earn Type', 'power-coupons' ) }
							</Table.HeadCell>
							<Table.HeadCell className="hidden lg:table-cell">
								{ __( 'Earn Value', 'power-coupons' ) }
							</Table.HeadCell>
							<Table.HeadCell className="hidden lg:table-cell">
								{ __( 'Priority', 'power-coupons' ) }
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
												<SkeletonLine width="w-24" />
											),
										},
										{
											className:
												'hidden lg:table-cell text-text-secondary text-sm font-normal',
											content: (
												<SkeletonLine width="w-28" />
											),
										},
										{
											className:
												'hidden lg:table-cell text-text-secondary text-sm font-normal',
											content: (
												<SkeletonLine width="w-10" />
											),
										},
										{
											className:
												'hidden lg:table-cell text-text-secondary text-sm font-normal',
											content: (
												<SkeletonLine width="w-8" />
											),
										},
										{ content: <SkeletonToggle /> },
										{
											content: (
												<SkeletonActions count={ 2 } />
											),
										},
									] }
								/>
							) }
							{ ! loading && 0 === campaigns.length && (
								<Table.Row>
									<Table.Cell
										colSpan={ 7 }
										className="w-full text-center text-text-secondary py-8"
									>
										{ __(
											'No campaigns found matching your search.',
											'power-coupons'
										) }
									</Table.Cell>
								</Table.Row>
							) }
							{ ! loading &&
								campaigns.map( ( campaign ) => (
									<Table.Row
										key={ campaign.id }
										value={ campaign }
										selected={ selected.includes(
											campaign.id
										) }
										onChangeSelection={
											handleCheckboxChange
										}
									>
										{ /* The name is the row's subject, so it
										     carries the primary color; every
										     other cell stays secondary. */ }
										<Table.Cell className="text-sm">
											<button
												type="button"
												className="bg-transparent border-none p-0 m-0 cursor-pointer text-text-primary hover:text-wpcolor hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wpcolor rounded-sm text-sm font-normal text-left"
												onClick={ () =>
													toggleModalOpen(
														false,
														campaign.id
													)
												}
											>
												{ campaign.title }
											</button>
										</Table.Cell>
										<Table.Cell className="hidden md:table-cell text-text-secondary text-sm font-normal">
											{ ACTION_TYPE_LABELS[
												campaign.action_type
											] || campaign.action_type }
										</Table.Cell>
										<Table.Cell className="hidden lg:table-cell text-text-secondary text-sm font-normal">
											{ renderEarnType( campaign ) }
										</Table.Cell>
										<Table.Cell className="hidden lg:table-cell text-text-secondary text-sm font-normal">
											{ campaign.earn_value }
										</Table.Cell>
										<Table.Cell className="hidden lg:table-cell text-text-secondary text-sm font-normal">
											{ campaign.priority }
										</Table.Cell>
										<Table.Cell>
											<Switch
												aria-label={ sprintf(
													/* translators: %s: campaign name */
													__(
														'Enable %s',
														'power-coupons'
													),
													campaign.title
												) }
												className="[&>input]:!border-none"
												defaultValue={
													campaign.status === 'active'
												}
												onChange={ ( checked ) =>
													toggleCampaignStatus(
														campaign.id,
														checked
															? 'active'
															: 'inactive'
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
												<LazyTooltip
													content={ __(
														'Edit',
														'power-coupons'
													) }
													portalRoot={
														portalRootRef.current
													}
												>
													<Button
														onClick={ () =>
															toggleModalOpen(
																false,
																campaign.id
															)
														}
														variant="ghost"
														icon={ <PencilIcon /> }
														size="xs"
														className="text-icon-secondary hover:text-icon-primary"
														aria-label={ actionLabel(
															__(
																'Edit',
																'power-coupons'
															),
															campaign.title
														) }
													/>
												</LazyTooltip>
												<LazyTooltip
													content={ __(
														'Delete',
														'power-coupons'
													) }
													portalRoot={
														portalRootRef.current
													}
												>
													<Button
														onClick={ () =>
															setDeleteModal( {
																isOpen: true,
																type: 'single',
																id: campaign.id,
															} )
														}
														variant="ghost"
														icon={ <TrashIcon /> }
														size="xs"
														className="text-icon-secondary hover:text-icon-primary"
														aria-label={ actionLabel(
															__(
																'Delete',
																'power-coupons'
															),
															campaign.title
														) }
													/>
												</LazyTooltip>
											</Container>
										</Table.Cell>
									</Table.Row>
								) ) }
						</Table.Body>
					</Table>
				</div>
			</div>

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
					deleteModal.type === 'bulk'
						? __( 'Delete Selected Campaigns', 'power-coupons' )
						: __( 'Delete Campaign', 'power-coupons' )
				}
				message={
					deleteModal.type === 'bulk'
						? sprintf(
								/* translators: %s: number of selected campaigns */
								__(
									'Are you sure you want to delete %s selected campaign(s)? This action cannot be undone.',
									'power-coupons'
								),
								selected.length
						  )
						: __(
								'Are you sure you want to delete this campaign? This action cannot be undone.',
								'power-coupons'
						  )
				}
				isLoading={ isDeleting }
			/>
		</>
	);
}

export default CampaignsList;
