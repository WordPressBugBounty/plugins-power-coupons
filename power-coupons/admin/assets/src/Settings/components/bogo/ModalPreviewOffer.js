import { __, sprintf } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Badge, Button } from '@bsf/force-ui';
import { fetchCategoriesByIds } from '../common/categoryLookup';
import { categoryAwareText } from './categorySupport';

// ─── Static lookup maps ───────────────────────────────────────────────────────

const OFFER_TYPE_LABELS = {
	'buy-x-get-x-free': __( 'Buy X Get X Free', 'power-coupons' ),
	'buy-x-get-y': __( 'Buy X Get Y', 'power-coupons' ),
	'buy-x-get-y-at-x-percent-off': __(
		'Buy X Get Y at X% Off',
		'power-coupons'
	),
	'spend-x-get-y-free': __( 'Spend $X Get Y for Free', 'power-coupons' ),
	'spend-x-get-y-at-x-percent-off': __(
		'Spend $X Get Y at X% Off',
		'power-coupons'
	),
	'spend-x-get-free-shipping': __(
		'Spend $X Get Free Shipping',
		'power-coupons'
	),
};

const DISCOUNT_TYPE_LABELS = {
	free: __( 'Free', 'power-coupons' ),
	percentage: __( 'Percentage', 'power-coupons' ),
	fixed: __( 'Fixed Amount', 'power-coupons' ),
};

const BUY_X_TYPES = [
	'buy-x-get-x-free',
	'buy-x-get-y',
	'buy-x-get-y-at-x-percent-off',
];
const SPEND_X_TYPES = [
	'spend-x-get-y-free',
	'spend-x-get-y-at-x-percent-off',
	'spend-x-get-free-shipping',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeading = ( { label } ) => (
	<div className="mb-2">
		{ /* text-text-tertiary here was #9CA3AF on white — 2.5:1, under the
		     4.5:1 floor for text this small. */ }
		<span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
			{ label }
		</span>
	</div>
);

const DetailRow = ( { label, value } ) => {
	if ( value === null || value === undefined || value === '' ) {
		return null;
	}
	return (
		<div className="flex flex-row items-start justify-between gap-4 py-2.5 border-0 border-t border-solid border-border-subtle first:border-t-0">
			<span className="text-sm font-medium text-text-primary">
				{ label }
			</span>
			<span className="text-sm text-text-secondary text-right min-w-0 break-words">
				{ value }
			</span>
		</div>
	);
};

// ─── Main modal component ─────────────────────────────────────────────────────

const ModalPreviewOffer = ( { offer, onClose } ) => {
	const [ buyProductNames, setBuyProductNames ] = useState( [] );
	const [ getProductNames, setGetProductNames ] = useState( [] );
	const [ loadingProducts, setLoadingProducts ] = useState( false );
	// Category names by term ID; empty while loading and after a failed lookup.
	const [ categoryNames, setCategoryNames ] = useState( {} );
	const [ loadingCategories, setLoadingCategories ] = useState( false );

	// Fetch category names whenever the offer changes. A category whose name can't
	// be loaded (deleted, or a failed lookup) is still listed, by ID.
	useEffect( () => {
		setCategoryNames( {} );

		if ( ! offer ) {
			return;
		}

		const allIds = [
			...new Set(
				[
					...( offer.buy_category_ids || [] ),
					...( offer.get_category_ids || [] ),
				]
					.map( Number )
					.filter( Boolean )
			),
		];

		if ( ! allIds.length ) {
			setLoadingCategories( false );
			return;
		}

		// A reply for an earlier offer must not overwrite this one's names.
		let current = true;
		setLoadingCategories( true );

		fetchCategoriesByIds( allIds )
			.then( ( categories ) => {
				if ( ! current ) {
					return;
				}
				const nameMap = {};
				categories.forEach( ( c ) => {
					nameMap[ c.id ] = c.name;
				} );
				setCategoryNames( nameMap );
			} )
			.catch( ( error ) => {
				console.error( 'Error fetching category names:', error );
			} )
			.finally( () => {
				if ( current ) {
					setLoadingCategories( false );
				}
			} );

		return () => {
			current = false;
		};
	}, [ offer ] );

	// Fetch product names whenever the offer changes.
	useEffect( () => {
		if ( ! offer ) {
			return;
		}

		const buyIds = ( offer.buy_product_ids || [] ).filter( Boolean );
		const getIds = ( offer.get_product_ids || [] ).filter( Boolean );
		const allIds = [ ...buyIds, ...getIds ];

		setBuyProductNames( [] );
		setGetProductNames( [] );

		if ( ! allIds.length ) {
			setLoadingProducts( false );
			return;
		}

		let current = true;
		const fallback = ( ids, nameMap = {} ) =>
			ids.map( ( id ) => nameMap[ id ] || `#${ id }` );

		setLoadingProducts( true );

		const formData = new FormData();
		formData.append( 'action', 'power_coupons_get_products_by_ids' );
		formData.append(
			'_wpnonce',
			window.powerCouponsSettings?.update_nonce || ''
		);
		allIds.forEach( ( id, index ) =>
			formData.append( `ids[${ index }]`, id )
		);

		fetch( ajaxurl, { method: 'POST', body: formData } )
			.then( ( r ) => r.json() )
			.then( ( result ) => {
				if ( ! current ) {
					return;
				}
				const nameMap = {};
				if ( result.success && Array.isArray( result.data ) ) {
					result.data.forEach( ( p ) => {
						nameMap[ p.id ] = p.name;
					} );
				}
				setBuyProductNames( fallback( buyIds, nameMap ) );
				setGetProductNames( fallback( getIds, nameMap ) );
			} )
			.catch( ( error ) => {
				console.error( 'Error fetching product names:', error );
				// Still list the products, by ID, rather than leave the rows empty.
				if ( current ) {
					setBuyProductNames( fallback( buyIds ) );
					setGetProductNames( fallback( getIds ) );
				}
			} )
			.finally( () => {
				if ( current ) {
					setLoadingProducts( false );
				}
			} );

		return () => {
			current = false;
		};
	}, [ offer ] ); // eslint-disable-line react-hooks/exhaustive-deps

	if ( ! offer ) {
		return null;
	}

	const isBuyX = BUY_X_TYPES.includes( offer.offer_type );
	const isSpendX = SPEND_X_TYPES.includes( offer.offer_type );
	const discountType = offer.discount_type || 'free';
	const showGetProducts =
		offer.offer_type !== 'buy-x-get-x-free' &&
		offer.offer_type !== 'spend-x-get-free-shipping';

	// Rows are decided from the offer's IDs, not from the names fetched for
	// them, so nothing disappears while loading or after a failed lookup.
	const isSpecificTrigger = offer.trigger_type === 'specific_products';
	const buyProductIds = ( offer.buy_product_ids || [] ).filter( Boolean );
	const getProductIds = ( offer.get_product_ids || [] ).filter( Boolean );
	const buyCategoryIds = ( offer.buy_category_ids || [] )
		.map( Number )
		.filter( Boolean );
	const getCategoryIds = ( offer.get_category_ids || [] )
		.map( Number )
		.filter( Boolean );
	const hasBuyCategories = buyCategoryIds.length > 0;
	const hasGetCategories = getCategoryIds.length > 0;

	// A category-only side has no products, which is not "any product".
	const showBuyProducts = buyProductIds.length > 0 || ! hasBuyCategories;
	const showGetProductRow =
		showGetProducts && ( getProductIds.length > 0 || ! hasGetCategories );

	const loadingText = __( 'Loading…', 'power-coupons' );
	const noneText = __( 'None selected', 'power-coupons' );

	const productNamesText = ( ids, names, emptyText ) => {
		if ( ! ids.length ) {
			return emptyText;
		}
		return loadingProducts || ! names.length
			? loadingText
			: names.join( ', ' );
	};

	const categoryNamesText = ( ids ) =>
		loadingCategories
			? loadingText
			: ids
					.map(
						( id ) =>
							categoryNames[ id ] ||
							sprintf(
								/* translators: %d: category ID. */
								__( 'Category #%d', 'power-coupons' ),
								id
							)
					)
					.join( ', ' );

	// "Any Products" only holds when the offer triggers on any product.
	const buyNames = productNamesText(
		buyProductIds,
		buyProductNames,
		isBuyX && isSpecificTrigger
			? noneText
			: __( 'Any Products', 'power-coupons' )
	);
	const getNames = productNamesText(
		getProductIds,
		getProductNames,
		noneText
	);

	return (
		<div
			className="fixed inset-0 z-[9999] flex items-center justify-center"
			role="dialog"
			aria-modal="true"
			aria-labelledby="bogo-preview-title"
		>
			<div
				className="absolute inset-0 bg-misc-overlay backdrop-blur-[1px]"
				onClick={ onClose }
			/>

			{ /* Modal panel */ }
			<div className="relative bg-background-primary rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-solid border-border-subtle">
				{ /* ── Header ── */ }
				<div className="flex items-center justify-between gap-4 px-6 py-5 border-0 border-b border-solid border-border-subtle">
					<h2
						id="bogo-preview-title"
						className="m-0 text-base font-semibold text-text-primary"
					>
						{ offer.name }
					</h2>
					<Button
						variant="ghost"
						size="xs"
						icon={ <XMarkIcon /> }
						onClick={ onClose }
						aria-label={ __( 'Close preview', 'power-coupons' ) }
						className="text-icon-secondary hover:text-icon-primary shrink-0"
					/>
				</div>

				{ /* ── Scrollable body ── */ }
				<div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
					{ /* Section — Offer Settings */ }
					<div>
						<SectionHeading
							label={ __( 'Offer Settings', 'power-coupons' ) }
						/>
						<div className="rounded-lg border border-solid border-border-subtle px-4">
							<DetailRow
								label={ __( 'Activation', 'power-coupons' ) }
								value={
									offer.activation_type === 'automatically'
										? __( 'Automatic', 'power-coupons' )
										: __(
												'Via Coupon Code',
												'power-coupons'
										  )
								}
							/>
							<DetailRow
								label={ __( 'Discount Type', 'power-coupons' ) }
								value={ DISCOUNT_TYPE_LABELS[ discountType ] }
							/>
							{ discountType === 'percentage' && (
								<DetailRow
									label={ __( 'Discount', 'power-coupons' ) }
									value={ `${
										offer.discount_percent || 0
									}%` }
								/>
							) }
							{ discountType === 'fixed' && (
								<DetailRow
									label={ __(
										'Discount Amount',
										'power-coupons'
									) }
									value={ `${ offer.discount_amount || 0 }` }
								/>
							) }
						</div>
					</div>

					{ /* Section — Conditions */ }
					<div>
						<SectionHeading
							label={ __( 'Conditions', 'power-coupons' ) }
						/>
						<div className="rounded-lg border border-solid border-border-subtle px-4">
							{ isBuyX && (
								<>
									<DetailRow
										label={ __(
											'Buy Quantity',
											'power-coupons'
										) }
										value={ offer.buy_quantity || 1 }
									/>
									<DetailRow
										label={ __(
											'Get Quantity',
											'power-coupons'
										) }
										value={ offer.get_quantity || 1 }
									/>
								</>
							) }
							{ isSpendX && (
								<>
									<DetailRow
										label={ __(
											'Minimum Spend',
											'power-coupons'
										) }
										value={ `$${
											offer.spend_amount || 0
										}` }
									/>
									{ offer.offer_type !==
										'spend-x-get-free-shipping' && (
										<DetailRow
											label={ __(
												'Get Quantity',
												'power-coupons'
											) }
											value={ offer.get_quantity || 1 }
										/>
									) }
								</>
							) }
							<DetailRow
								label={ __( 'Trigger', 'power-coupons' ) }
								value={
									isSpecificTrigger
										? categoryAwareText( 'triggerHeading' )
										: __( 'All Products', 'power-coupons' )
								}
							/>
						</div>
					</div>

					{ /* Section — Products (always shown) */ }
					<div>
						<SectionHeading
							label={ __( 'Products', 'power-coupons' ) }
						/>
						<div
							className="rounded-lg border border-solid border-border-subtle px-4"
							aria-live="polite"
							aria-busy={
								loadingProducts || loadingCategories
									? 'true'
									: undefined
							}
						>
							{ showBuyProducts && (
								<DetailRow
									label={ __(
										'Products to Buy',
										'power-coupons'
									) }
									value={ buyNames }
								/>
							) }
							{ hasBuyCategories && (
								<DetailRow
									label={ __(
										'Categories to Buy',
										'power-coupons'
									) }
									value={ categoryNamesText(
										buyCategoryIds
									) }
								/>
							) }
							{ showGetProductRow && (
								<DetailRow
									label={ __(
										'Products to Get',
										'power-coupons'
									) }
									value={ getNames }
								/>
							) }
							{ showGetProducts && hasGetCategories && (
								<DetailRow
									label={ __(
										'Categories to Get',
										'power-coupons'
									) }
									value={ categoryNamesText(
										getCategoryIds
									) }
								/>
							) }
						</div>
					</div>
				</div>

				{ /* ── Footer ── */ }
				<div className="px-6 py-4 bg-background-primary flex flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-border-subtle">
					<div className="flex items-center gap-2">
						<Badge
							label={
								offer.status === 'active'
									? __( 'Active', 'power-coupons' )
									: __( 'Inactive', 'power-coupons' )
							}
							size="xs"
							type="pill"
							variant={
								offer.status === 'active' ? 'green' : 'neutral'
							}
							disableHover={ true }
						/>
						<Badge
							label={
								OFFER_TYPE_LABELS[ offer.offer_type ] ||
								__( 'Custom', 'power-coupons' )
							}
							size="xs"
							type="pill"
							variant="yellow"
							disableHover={ true }
						/>
					</div>
					<Button
						variant="outline"
						size="sm"
						tag="button"
						type="button"
						onClick={ onClose }
						className="font-medium"
					>
						{ __( 'Close', 'power-coupons' ) }
					</Button>
				</div>
			</div>
		</div>
	);
};

export default ModalPreviewOffer;
