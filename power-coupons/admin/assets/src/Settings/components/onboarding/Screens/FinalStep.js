import { __ } from '@wordpress/i18n';
import { Button, Label } from '@bsf/force-ui';
import { ArrowRight, Check, ExternalLink } from 'lucide-react';
import { Header } from '../Components';
import { useOnboardingContext } from '../Context';
import { PRIMARY_BUTTON_CLASS } from '../Utils';

const FinalStep = () => {
	const { data } = useOnboardingContext();

	// Destinations come from the server so nothing here guesses an admin slug.
	const links = window.powerCouponsSettings?.onboarding?.links || {};

	// The claims on this screen have to match what the merchant actually chose.
	const settings = data?.[ 1 ] || {};
	const showsAnywhere =
		!! settings.show_on_cart || !! settings.show_on_checkout;

	// What the store already has decides what comes next. Without it the screen
	// offered "Create your first coupon" and "Review your existing coupons" at
	// the same time, one of which is always wrong.
	const hasCoupons =
		( window.powerCouponsSettings?.onboarding?.couponCount || 0 ) > 0;

	const unlocked = [
		{
			heading: __( 'Effortless discounts', 'power-coupons' ),
			description: showsAnywhere
				? __(
						'Customers see and apply coupons with a single click.',
						'power-coupons'
				  )
				: __(
						'Turn on cart or checkout display any time to show coupons to customers.',
						'power-coupons'
				  ),
		},
		{
			heading: __( 'Higher conversions', 'power-coupons' ),
			description: __(
				'Smart coupon display encourages customers to complete their purchase.',
				'power-coupons'
			),
		},
		{
			heading: __( 'Peace of mind', 'power-coupons' ),
			description: __(
				'Automated coupon rules work in the background so you can focus on growing your business.',
				'power-coupons'
			),
		},
	];

	// Whatever the primary button is not. The two used to sit on the same screen
	// as each other and as the button, three offers for one decision.
	const nextSteps = [
		hasCoupons && {
			label: __( 'Create another coupon', 'power-coupons' ),
			href: links.newCoupon,
		},
		{
			// The one thing the wizard never asks about: the words a shopper
			// actually reads on the cart.
			label: __( 'Customize the wording customers see', 'power-coupons' ),
			href: links.textLabels,
		},
		{
			label: __( 'Fine-tune your coupon settings', 'power-coupons' ),
			href: links.settings,
		},
	].filter( ( step ) => !! step && !! step.href );

	/*
	 * One action the merchant can actually complete from here.
	 *
	 * This used to point at the store's cart page whenever cart display was on,
	 * which lands a freshly set-up admin on an empty cart showing no coupons —
	 * the wizard's closing promise disproving itself. A cart cannot demonstrate
	 * anything until a coupon exists, a session has items, and a rule matches,
	 * and none of that is in the wizard's gift.
	 */
	const primaryCta = hasCoupons
		? {
				label: __( 'View Your Coupons', 'power-coupons' ),
				href: links.allCoupons,
		  }
		: {
				label: __( 'Create Your First Coupon', 'power-coupons' ),
				href: links.newCoupon,
		  };

	return (
		<>
			<Header
				size="lg"
				heading={ __( "You're All Set! 🎉", 'power-coupons' ) }
				subHeading={ __(
					'Power Coupons is live on your store and ready to deliver smart discounts that keep customers happy and drive more revenue.',
					'power-coupons'
				) }
			/>

			<div className="flex flex-col gap-2">
				<Label
					as="span"
					className="text-text-primary font-semibold block"
				>
					{ __( "Here's What You've Unlocked:", 'power-coupons' ) }
				</Label>
				<ul className="list-none pl-0 m-0 space-y-2">
					{ unlocked.map( ( item ) => (
						<li
							key={ item.heading }
							className="flex items-start gap-2 text-sm text-text-secondary"
						>
							<Check
								className="size-4 text-support-success shrink-0 mt-0.5"
								aria-hidden="true"
							/>
							<span>
								<strong className="text-text-primary">
									{ item.heading }:
								</strong>{ ' ' }
								{ item.description }
							</span>
						</li>
					) ) }
				</ul>
			</div>

			<div className="flex flex-col gap-2">
				<Label
					as="span"
					className="text-text-primary font-semibold block"
				>
					{ 1 === nextSteps.length
						? __( 'Recommended Next Step:', 'power-coupons' )
						: __( 'Recommended Next Steps:', 'power-coupons' ) }
				</Label>
				<ul className="list-none pl-0 m-0 space-y-2">
					{ nextSteps.map( ( item ) => (
						<li
							key={ item.href }
							className="flex items-center gap-1.5 text-sm"
						>
							<ArrowRight
								className="size-4 text-icon-interactive shrink-0"
								aria-hidden="true"
							/>
							<Button
								tag="a"
								href={ item.href }
								variant="link"
								size="sm"
								className="text-wpcolor hover:text-wphovercolor no-underline"
							>
								{ item.label }
							</Button>
						</li>
					) ) }
				</ul>
			</div>

			<div className="flex flex-col gap-3">
				{ /* The primary action points at whatever the merchant just switched on. */ }
				<Button
					tag="a"
					href={ primaryCta.href }
					variant="primary"
					size="md"
					className={ `w-full box-border flex items-center justify-center no-underline ${ PRIMARY_BUTTON_CLASS }` }
				>
					{ primaryCta.label }
				</Button>
				<Button
					tag="a"
					href={ links.dashboard }
					variant="outline"
					size="md"
					className="w-full box-border flex items-center justify-center no-underline"
				>
					{ __( 'Go to Dashboard', 'power-coupons' ) }
				</Button>
				{ links.docs && (
					<Button
						tag="a"
						href={ links.docs }
						target="_blank"
						rel="noreferrer"
						variant="link"
						size="sm"
						className="w-full box-border justify-center text-text-secondary hover:text-wphovercolor no-underline"
						icon={ <ExternalLink className="size-4" /> }
						iconPosition="right"
					>
						{ __( 'Documentation', 'power-coupons' ) }
					</Button>
				) }
			</div>
		</>
	);
};

export default FinalStep;
