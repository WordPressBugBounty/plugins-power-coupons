import { __ } from '@wordpress/i18n';

const ArrowUpRightIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M7 17L17 7" />
		<path d="M7 7h10v10" />
	</svg>
);

function UpgradeNotice( {
	title,
	description,
	buttonLabel,
	utmMedium = 'free-power-coupons',
	className = '',
} ) {
	const resolvedTitle =
		title ||
		__(
			'Looking to unlock more advanced coupon features?',
			'power-coupons'
		);
	const resolvedDescription =
		description ||
		__(
			'Upgrade to Power Coupons Pro to unlock BOGO offers, advanced discount rules, loyalty points, and more.',
			'power-coupons'
		);
	const resolvedButton = buttonLabel || __( 'Upgrade Now', 'power-coupons' );

	const pricingUrl = `https://cartflows.com/power-coupons-for-woocommerce/pricing/?utm_source=dashboard&utm_medium=${ encodeURIComponent(
		utmMedium
	) }&utm_campaign=go-pro`;

	return (
		// Not `role="banner"`: that is the page-header landmark and a document
		// gets exactly one. This is a complementary aside.
		<div
			className={ `flex flex-row items-stretch gap-2 p-3 rounded-lg border border-solid border-wpcolor bg-wphovercolorfaded shadow-sm ${ className }` }
			role="complementary"
			aria-label={ __( 'Upgrade to Power Coupons Pro', 'power-coupons' ) }
		>
			<div className="flex flex-row items-center gap-2 flex-1">
				<div className="flex flex-col gap-1 flex-1">
					<span className="text-sm font-semibold text-text-primary leading-5">
						{ resolvedTitle }
					</span>
					<span className="text-sm font-normal text-text-secondary leading-5">
						{ resolvedDescription }
					</span>
				</div>

				<div className="flex items-center gap-2 shrink-0">
					<a
						href={ pricingUrl }
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-sm font-medium text-wpcolor hover:text-wphovercolor no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wpcolor focus-visible:ring-offset-2"
					>
						{ resolvedButton }
						<ArrowUpRightIcon />
					</a>
				</div>
			</div>
		</div>
	);
}

export default UpgradeNotice;
