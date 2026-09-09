import { __ } from '@wordpress/i18n';
import { Check } from 'lucide-react';
import { Header, NavButtons } from '../Components';

const features = [
	__(
		'Display available coupons beautifully on cart and checkout pages.',
		'power-coupons'
	),
	__(
		'Let customers apply coupons with a single click, no copy-pasting needed.',
		'power-coupons'
	),
	__(
		'Auto-apply coupons based on smart rules and conditions.',
		'power-coupons'
	),
	__( 'Create BOGO offers to boost average order value.', 'power-coupons' ),
	__(
		'Customize coupon styles, colors, and text to match your brand.',
		'power-coupons'
	),
];

const Welcome = () => (
	<>
		<Header
			size="lg"
			heading={ __( 'Welcome to Power Coupons', 'power-coupons' ) }
			badge={ __( '≈ 2 min setup', 'power-coupons' ) }
			subHeading={ __(
				'Supercharge your WooCommerce store with powerful, flexible discount features!',
				'power-coupons'
			) }
		/>

		{ /* Muted is required — browsers block autoplay with sound. */ }
		<div className="rounded-lg overflow-hidden aspect-video">
			<iframe
				className="w-full h-full"
				src="https://www.youtube-nocookie.com/embed/Uj6ZMyXoLug?autoplay=1&mute=1&rel=0&modestbranding=1"
				title={ __( 'Power Coupons walkthrough', 'power-coupons' ) }
				frameBorder="0"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowFullScreen
			></iframe>
		</div>

		<ul className="list-none pl-0 m-0 space-y-2.5">
			{ features.map( ( feature ) => (
				<li
					key={ feature }
					className="flex items-start gap-2 text-sm font-medium text-text-secondary"
				>
					<Check
						className="size-4 text-support-success shrink-0 mt-0.5"
						aria-hidden="true"
					/>
					<span>{ feature }</span>
				</li>
			) ) }
		</ul>

		<NavButtons
			nextFullWidth
			nextLabel={ __( 'Set Up My Coupons', 'power-coupons' ) }
		/>
	</>
);

export default Welcome;
