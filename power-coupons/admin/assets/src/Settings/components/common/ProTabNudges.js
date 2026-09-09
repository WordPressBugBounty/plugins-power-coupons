import { __ } from '@wordpress/i18n';

const CartProgressVisual = () => (
	<svg
		viewBox="0 0 280 280"
		width={ 280 }
		height={ 280 }
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect width="280" height="280" rx="14" fill="#FFF7F4" />

		<rect
			x="26"
			y="42"
			width="228"
			height="194"
			rx="10"
			fill="white"
			stroke="#ECD6C6"
			strokeWidth="1.5"
		/>

		<rect x="26" y="42" width="228" height="28" rx="10" fill="#ECD6C6" />

		<rect x="26" y="60" width="228" height="10" fill="#ECD6C6" />

		<circle cx="46" cy="56" r="5" fill="#F16334" />
		<circle cx="62" cy="56" r="5" fill="#F16334" fillOpacity="0.45" />
		<circle cx="78" cy="56" r="5" fill="#F16334" fillOpacity="0.2" />

		<rect x="43" y="82" width="194" height="46" rx="7" fill="#F5C2A0" />

		<circle cx="82" cy="105" r="11" fill="white" fillOpacity="0.62" />

		<path
			d="M77,105 L80,109 L87,99"
			fill="none"
			stroke="#C05A28"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>

		<rect
			x="93"
			y="103"
			width="37"
			height="4"
			rx="2"
			fill="white"
			fillOpacity="0.55"
		/>

		<circle cx="140" cy="105" r="11" fill="white" fillOpacity="0.62" />

		<path
			d="M135,105 L138,109 L145,99"
			fill="none"
			stroke="#C05A28"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>

		<rect
			x="151"
			y="103"
			width="37"
			height="4"
			rx="2"
			fill="white"
			fillOpacity="0.28"
		/>

		<circle
			cx="198"
			cy="105"
			r="11"
			fill="none"
			stroke="white"
			strokeOpacity="0.62"
			strokeWidth="2"
		/>

		<polygon
			points="198,97 199.8,102.4 205.5,102.4 200.9,105.7 202.6,111 198,107.9 193.4,111 195.1,105.7 190.5,102.4 196.2,102.4"
			fill="white"
			fillOpacity="0.55"
		/>

		<rect x="43" y="142" width="128" height="9" rx="4" fill="#ECD6C6" />

		<rect
			x="43"
			y="157"
			width="104"
			height="9"
			rx="4"
			fill="#ECD6C6"
			fillOpacity="0.7"
		/>

		<rect
			x="43"
			y="172"
			width="80"
			height="9"
			rx="4"
			fill="#ECD6C6"
			fillOpacity="0.45"
		/>

		<rect x="43" y="194" width="194" height="13" rx="6.5" fill="#ECD6C6" />

		<rect x="43" y="194" width="116" height="13" rx="6.5" fill="#F16334" />
	</svg>
);

const LoyaltyVisual = () => (
	<svg
		viewBox="0 0 280 280"
		width={ 280 }
		height={ 280 }
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect width="280" height="280" rx="14" fill="#FFF7F4" />

		<rect
			x="26"
			y="42"
			width="228"
			height="194"
			rx="10"
			fill="white"
			stroke="#ECD6C6"
			strokeWidth="1.5"
		/>

		<rect x="26" y="42" width="228" height="28" rx="10" fill="#ECD6C6" />

		<rect x="26" y="60" width="228" height="10" fill="#ECD6C6" />

		<circle cx="46" cy="56" r="5" fill="#F16334" />
		<circle cx="62" cy="56" r="5" fill="#F16334" fillOpacity="0.45" />
		<circle cx="78" cy="56" r="5" fill="#F16334" fillOpacity="0.2" />

		<rect x="43" y="82" width="194" height="52" rx="7" fill="#F5C2A0" />

		<polygon
			points="140,90 144.4,101.9 157.1,102.4 147.1,110.3 150.6,122.6 140,115.5 129.4,122.6 132.9,110.3 122.9,102.4 135.6,101.9"
			fill="white"
			fillOpacity="0.44"
		/>

		<rect x="43" y="148" width="128" height="9" rx="4" fill="#ECD6C6" />

		<rect
			x="43"
			y="163"
			width="104"
			height="9"
			rx="4"
			fill="#ECD6C6"
			fillOpacity="0.65"
		/>

		<polygon
			points="68,173 70.9,181 79.4,181.3 72.8,186.6 75.1,194.7 68,190 60.9,194.7 63.2,186.6 56.6,181.3 65.1,181"
			fill="#F16334"
		/>

		<polygon
			points="104,173 106.9,181 115.4,181.3 108.8,186.6 111.1,194.7 104,190 96.9,194.7 99.2,186.6 92.6,181.3 101.1,181"
			fill="#F16334"
		/>

		<polygon
			points="140,173 142.9,181 151.4,181.3 144.8,186.6 147.1,194.7 140,190 132.9,194.7 135.2,186.6 128.6,181.3 137.1,181"
			fill="#F16334"
		/>

		<polygon
			points="176,173 178.9,181 187.4,181.3 180.8,186.6 183.1,194.7 176,190 168.9,194.7 171.2,186.6 164.6,181.3 173.1,181"
			fill="#F16334"
		/>

		<polygon
			points="212,173 214.9,181 223.4,181.3 216.8,186.6 219.1,194.7 212,190 204.9,194.7 207.2,186.6 200.6,181.3 209.1,181"
			fill="#F16334"
		/>

		<rect
			x="43"
			y="208"
			width="194"
			height="16"
			rx="7"
			fill="#F16334"
			fillOpacity="0.82"
		/>
	</svg>
);

const GiftCardsVisual = () => (
	<svg
		viewBox="0 0 280 280"
		width={ 280 }
		height={ 280 }
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect width="280" height="280" rx="14" fill="#FFF7F4" />

		<rect
			x="22"
			y="46"
			width="190"
			height="116"
			rx="10"
			fill="#ECD6C6"
			stroke="#E0C8B6"
			strokeWidth="0.5"
		/>

		<rect x="22" y="46" width="190" height="28" rx="10" fill="#E0C8B6" />

		<rect x="22" y="64" width="190" height="10" fill="#E0C8B6" />

		<circle cx="39" cy="60" r="4.5" fill="#F16334" fillOpacity="0.5" />
		<circle cx="52" cy="60" r="4.5" fill="#F16334" fillOpacity="0.28" />
		<circle cx="65" cy="60" r="4.5" fill="#F16334" fillOpacity="0.14" />

		<rect
			x="37"
			y="89"
			width="86"
			height="14"
			rx="5"
			fill="white"
			fillOpacity="0.4"
		/>

		<circle cx="40" cy="124" r="3.5" fill="white" fillOpacity="0.42" />
		<circle cx="49" cy="124" r="3.5" fill="white" fillOpacity="0.42" />
		<circle cx="58" cy="124" r="3.5" fill="white" fillOpacity="0.42" />
		<circle cx="67" cy="124" r="3.5" fill="white" fillOpacity="0.42" />

		<rect x="68" y="118" width="190" height="116" rx="10" fill="#F16334" />

		<circle cx="224" cy="140" r="46" fill="white" fillOpacity="0.06" />
		<circle cx="194" cy="208" r="32" fill="white" fillOpacity="0.04" />

		<rect
			x="68"
			y="118"
			width="190"
			height="28"
			rx="10"
			fill="white"
			fillOpacity="0.1"
		/>

		<rect
			x="68"
			y="136"
			width="190"
			height="10"
			fill="white"
			fillOpacity="0.1"
		/>

		<circle cx="85" cy="132" r="4.5" fill="white" fillOpacity="0.65" />
		<circle cx="98" cy="132" r="4.5" fill="white" fillOpacity="0.38" />
		<circle cx="111" cy="132" r="4.5" fill="white" fillOpacity="0.2" />

		<path
			d="M163,161 Q155,151 149,155 Q147,161 158,161 Z"
			fill="white"
			fillOpacity="0.38"
		/>

		<path
			d="M163,161 Q171,151 177,155 Q179,161 168,161 Z"
			fill="white"
			fillOpacity="0.38"
		/>

		<rect
			x="142"
			y="161"
			width="42"
			height="9"
			rx="2"
			fill="white"
			fillOpacity="0.3"
		/>

		<rect
			x="142"
			y="164"
			width="42"
			height="4"
			rx="1"
			fill="white"
			fillOpacity="0.5"
		/>

		<rect
			x="161"
			y="161"
			width="4"
			height="34"
			rx="1"
			fill="white"
			fillOpacity="0.5"
		/>

		<rect
			x="145"
			y="170"
			width="36"
			height="25"
			rx="2"
			fill="white"
			fillOpacity="0.24"
		/>

		<circle cx="94" cy="207" r="3.5" fill="white" fillOpacity="0.34" />
		<circle cx="103" cy="207" r="3.5" fill="white" fillOpacity="0.34" />
		<circle cx="112" cy="207" r="3.5" fill="white" fillOpacity="0.34" />
		<circle cx="121" cy="207" r="3.5" fill="white" fillOpacity="0.34" />

		<rect
			x="129"
			y="203"
			width="2"
			height="8"
			rx="1"
			fill="white"
			fillOpacity="0.2"
		/>

		<circle cx="138" cy="207" r="3.5" fill="white" fillOpacity="0.34" />
		<circle cx="147" cy="207" r="3.5" fill="white" fillOpacity="0.34" />
		<circle cx="156" cy="207" r="3.5" fill="white" fillOpacity="0.34" />
		<circle cx="165" cy="207" r="3.5" fill="white" fillOpacity="0.34" />

		<rect
			x="173"
			y="203"
			width="2"
			height="8"
			rx="1"
			fill="white"
			fillOpacity="0.2"
		/>

		<rect
			x="181"
			y="202"
			width="46"
			height="10"
			rx="4"
			fill="white"
			fillOpacity="0.5"
		/>
	</svg>
);

const getProTabNudges = () => ( {
	power_coupons_cart_progress_bar: {
		title: __( 'Boost AOV with a Cart Progress Bar', 'power-coupons' ),
		subtitle: __(
			'Encourage shoppers to add more to their cart by showing a live progress indicator toward rewards like free shipping or discounts.',
			'power-coupons'
		),
		description: [
			__(
				'Set dynamic milestones tied to cart total or item count',
				'power-coupons'
			),
			__(
				'Customise bar colours, messaging, and success states to match your brand',
				'power-coupons'
			),
			__(
				'Displayed on cart and checkout pages with smooth animations',
				'power-coupons'
			),
		],
		utmMedium: 'free-power-coupons-cart-progress-bar',
		visual: <CartProgressVisual />,
	},
	power_coupons_points: {
		title: __(
			'Reward loyal customers with Points & Rewards',
			'power-coupons'
		),
		subtitle: __(
			'Give shoppers credit for every order, nudge repeat purchases, and let them redeem points for discounts, all on autopilot.',
			'power-coupons'
		),
		description: [
			__(
				'Automatically award points on purchases with configurable earn rates',
				'power-coupons'
			),
			__(
				'Let customers redeem points as cart discounts at checkout',
				'power-coupons'
			),
			__(
				'Run time-boxed campaigns, control expiry, and view each customer’s balance',
				'power-coupons'
			),
		],
		utmMedium: 'free-power-coupons-points',
		visual: <LoyaltyVisual />,
	},
	power_coupons_gift_cards: {
		title: __( 'Sell Gift Cards and grow revenue', 'power-coupons' ),
		subtitle: __(
			'Let customers buy gift cards for friends and family. Perfect for holidays, launches, and recovering lost sales.',
			'power-coupons'
		),
		description: [
			__(
				'Offer preset and custom gift card amounts with branded designs',
				'power-coupons'
			),
			__(
				'Redeem gift cards as discount credits at checkout',
				'power-coupons'
			),
			__(
				'Restrict redemption by product or category for full control',
				'power-coupons'
			),
		],
		utmMedium: 'free-power-coupons-gift-cards',
		visual: <GiftCardsVisual />,
	},
} );

export default getProTabNudges;
