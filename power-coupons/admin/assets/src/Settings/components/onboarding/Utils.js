import Welcome from './Screens/Welcome';
import ConfigureCoupons from './Screens/ConfigureCoupons';
import UserDetails from './Screens/UserDetails';
import RecommendPlugins from './Screens/RecommendPlugins';
import FinalStep from './Screens/FinalStep';
import { __ } from '@wordpress/i18n';

import CartFlowsLogo from '../../../../images/logos/cartflows.gif';
import ModernCartLogo from '../../../../images/logos/modern-cart.svg';
import WCARLogo from '../../../../images/logos/wcar.gif';
import SureFormsLogo from '../../../../images/logos/sureforms.gif';
import SureRankLogo from '../../../../images/logos/surerank.jpg';

/**
 * The wizard, in order.
 *
 * `slug` drives the `?step=` query param so reload and browser Back work.
 * `label` names the step in the progress bar — bare numbers tell the merchant
 * nothing about what is coming.
 * `width` lets each step size itself to its own content instead of every step
 * sharing one 718px card.
 * `analyticsSlug` is the name reported as `exit_step`. It is deliberately not
 * `slug`: those names are already in the analytics dashboard from earlier
 * releases, so renaming them would split every exit funnel in two. Changing a
 * URL is free; changing a tracked value is not.
 *
 * The array index is also the key the answers are stored under, and the server
 * reads those same indices in `complete_onboarding()` — do not reorder without
 * updating `get_onboarding_defaults()`.
 */
const Screens = [
	{
		slug: 'welcome',
		analyticsSlug: 'welcome',
		label: __( 'Welcome', 'power-coupons' ),
		component: Welcome,
		width: 'md:w-[40rem]',
	},
	{
		slug: 'configure',
		analyticsSlug: 'configure',
		label: __( 'Coupons', 'power-coupons' ),
		component: ConfigureCoupons,
		width: 'md:w-[44rem]',
	},
	{
		slug: 'details',
		analyticsSlug: 'user-details',
		label: __( 'Updates', 'power-coupons' ),
		component: UserDetails,
		width: 'md:w-[47rem]',
	},
	{
		slug: 'add-ons',
		analyticsSlug: 'recommend-plugins',
		label: __( 'Plugins', 'power-coupons' ),
		component: RecommendPlugins,
		width: 'md:w-[44rem]',
	},
	{
		slug: 'done',
		analyticsSlug: 'final',
		label: __( 'Done', 'power-coupons' ),
		component: FinalStep,
		width: 'md:w-[40rem]',
	},
];

const RecommendedPlugins = [
	{
		name: 'CartFlows',
		description: __(
			'Create beautiful checkout pages & sales funnels for WooCommerce.',
			'power-coupons'
		),
		slug: 'cartflows',
		logo: CartFlowsLogo,
	},
	{
		name: 'Modern Cart',
		description: __(
			'Add a sleek side cart and free shipping bar to keep shoppers buying.',
			'power-coupons'
		),
		slug: 'modern-cart',
		logo: ModernCartLogo,
	},
	{
		name: 'Cart Abandonment Recovery',
		description: __(
			'Start recovering lost revenue with ease in less than 10 minutes.',
			'power-coupons'
		),
		slug: 'woo-cart-abandonment-recovery',
		logo: WCARLogo,
	},
	{
		name: 'SureForms',
		description: __(
			'Create forms that feel like a chat. One question at a time keeps users engaged.',
			'power-coupons'
		),
		slug: 'sureforms',
		logo: SureFormsLogo,
	},
	{
		name: 'SureRank',
		description: __(
			'Just a simple, lightweight SEO assistant that helps your site rise in the rankings.',
			'power-coupons'
		),
		slug: 'surerank',
		logo: SureRankLogo,
	},
];

/**
 * Human-readable install state for a recommended plugin.
 *
 * The server already distinguishes all three states; the wizard used to render
 * `inactive` and `not-installed` as the same bare checkbox.
 */
const PluginStatusDisplay = {
	'not-installed': {
		label: __( 'Not installed', 'power-coupons' ),
		dot: '',
		text: 'text-text-secondary',
	},
	inactive: {
		label: __( 'Not activated', 'power-coupons' ),
		dot: 'bg-support-warning',
		text: 'text-text-secondary',
	},
	installing: {
		label: __( 'Installing…', 'power-coupons' ),
		dot: '',
		text: 'text-wpcolor',
	},
	failed: {
		label: __( 'Install failed', 'power-coupons' ),
		dot: 'bg-support-error',
		text: 'text-support-error',
	},
	active: {
		label: __( 'Active', 'power-coupons' ),
		dot: 'bg-support-success',
		text: 'text-support-success',
	},
};

/**
 * Force UI's primary button is the platform purple; this plugin's brand is the
 * WordPress admin orange. Applied wherever the wizard renders a primary action.
 */
const PRIMARY_BUTTON_CLASS =
	'bg-wpcolor hover:bg-wphovercolor outline-wpcolor hover:outline-wphovercolor';

const adminUrl = ( path ) => `admin.php?page=power_coupons_settings${ path }`;

const RedirectToDashboard = () => {
	window.location.href = adminUrl( '' );
};

export {
	Screens,
	RecommendedPlugins,
	PluginStatusDisplay,
	PRIMARY_BUTTON_CLASS,
	RedirectToDashboard,
	adminUrl,
};
