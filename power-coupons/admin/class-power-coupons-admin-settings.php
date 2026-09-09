<?php
/**
 * Admin Settings Class
 *
 * @package Power_Coupons
 * @since 1.0.0
 */

namespace Power_Coupons\Admin;

use Power_Coupons\Includes\Power_Coupons_Settings_Helper;
use Power_Coupons\Includes\Power_Coupons_Utilities;
use Power_Coupons\Includes\Traits\Power_Coupons_Singleton;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Class Power_Coupons_Admin_Settings
 */
class Power_Coupons_Admin_Settings {

	use Power_Coupons_Singleton;

	/**
	 * Option key for settings
	 *
	 * @var string
	 */
	const OPTION_KEY = 'power_coupons_settings';

	/**
	 * Pricing/upgrade URL used by the "Upgrade to Pro" menu item and header button.
	 *
	 * @var string
	 */
	const UPGRADE_URL = 'https://cartflows.com/power-coupons-for-woocommerce/pricing/?utm_source=dashboard&utm_medium=free-power-coupons&utm_campaign=go-pro';

	/**
	 * Constructor
	 *
	 * @since 1.0.0
	 */
	protected function __construct() {
		$this->init_hooks();
	}

	/**
	 * Initialize hooks
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private function init_hooks() {
		add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_settings_assets' ) );
		add_action( 'wp_ajax_power_coupons_update_settings', array( $this, 'ajax_update_settings' ) );
		add_action( 'wp_ajax_power_coupons_activate_pro', array( $this, 'ajax_activate_pro' ) );
		add_action( 'wp_ajax_power_coupons_complete_onboarding', array( $this, 'complete_onboarding' ) );
		add_action( 'wp_ajax_power_coupons_onboarding_skipped', array( $this, 'ajax_onboarding_skipped' ) );
		add_action( 'wp_ajax_power_coupons_install_plugin', array( $this, 'ajax_install_plugin' ) );

		// One-shot guard for the page load right after onboarding. Plugins installed during
		// onboarding (e.g. Cart Abandonment Recovery) queue a post-activation redirect that
		// hijacks the "Go To Dashboard" navigation. Rather than skip their activation hooks,
		// we let them run normally and reclaim the redirect target back to our dashboard.
		add_action( 'admin_init', array( $this, 'maybe_reclaim_post_onboarding_redirect' ), 0 );
		add_action( 'admin_init', array( $this, 'maybe_redirect_to_onboarding' ) );

		// Highlight the "Upgrade to Pro" submenu and open it in a new tab (free plugin only).
		// Hooked on admin_footer so the #adminmenu DOM already exists when the script runs.
		if ( ! defined( 'POWER_COUPONS_PRO_VERSION' ) ) {
			add_action( 'admin_footer', array( $this, 'highlight_upgrade_menu' ) );
		}
	}

	/**
	 * Style the "Upgrade to Pro" admin submenu item and force it to open in a new tab.
	 *
	 * @since 1.0.6
	 * @return void
	 */
	public function highlight_upgrade_menu() {
		?>
		<style>
			#adminmenu li a.power-coupons-upgrade-link {
				color: #16a34a !important;
				font-weight: 600;
			}
			#adminmenu li a.power-coupons-upgrade-link:hover,
			#adminmenu li a.power-coupons-upgrade-link:focus {
				color: #15803d !important;
			}
		</style>
		<script>
			( function() {
				// Match the href in JS rather than via an attribute selector: the URL contains
				// "://", "?" and "&", which are invalid in an unquoted CSS attribute value and
				// would make querySelector throw a SyntaxError. wp_json_encode() yields a
				// safely-escaped JS string literal to compare against. Styling is applied via a
				// CSS class (see <style> above) rather than injecting the URL into CSS.
				var url  = <?php echo wp_json_encode( self::UPGRADE_URL ); ?>;
				var link = Array.prototype.find.call(
					document.querySelectorAll( '#adminmenu a' ),
					function( a ) { return a.getAttribute( 'href' ) === url; }
				);
				if ( link ) {
					link.classList.add( 'power-coupons-upgrade-link' );
					link.setAttribute( 'target', '_blank' );
					link.setAttribute( 'rel', 'noopener noreferrer' );
				}
			} )();
		</script>
		<?php
	}

	/**
	 * Build the base64 data URI for the admin menu icon.
	 *
	 * `file_get_contents()` returns false for a missing or unreadable file.
	 * Without `declare(strict_types=1)` — which this file does not use — PHP
	 * coerces that false to '', so `base64_encode()` does not throw: the menu
	 * simply gets `data:image/svg+xml;base64,` and renders a blank icon, with
	 * no warning to explain it. (Verified on PHP 8.2; it would be a TypeError
	 * only under strict types.) Fall back to a Dashicon instead, so a missing
	 * asset degrades to something visible.
	 *
	 * @since 1.0.7
	 * @return string Data URI, or a dashicon name.
	 */
	private static function get_menu_icon() {
		$path = POWER_COUPONS_DIR . 'admin/assets/images/logo.svg';

		if ( is_readable( $path ) ) {
			$svg = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local plugin asset, not a remote request.
			if ( is_string( $svg ) && '' !== $svg ) {
				return 'data:image/svg+xml;base64,' . base64_encode( $svg ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Required data URI encoding.
			}
		}

		return 'dashicons-tickets-alt';
	}

	/**
	 * Add admin menu
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function add_admin_menu() {
		$menu_items = apply_filters(
			'power_coupons_filter_admin_menus',
			array(
				'menu'    => array(
					'settings' => array(
						'page_title' => __( 'Power Coupons', 'power-coupons' ),
						'menu_title' => __( 'Power Coupons', 'power-coupons' ),
						'capability' => 'manage_woocommerce',
						'menu_slug'  => 'power_coupons_settings',
						'callback'   => array( $this, 'render_settings_page' ),
						'icon'       => self::get_menu_icon(),
						'position'   => 56,
					),
				),
				'submenu' => array(
					'all_coupons' => array(
						'parent'     => 'power_coupons_settings',
						'page_title' => __( 'All coupons', 'power-coupons' ),
						'menu_title' => __( 'All coupons', 'power-coupons' ),
						'capability' => 'edit_shop_coupons',
						'menu_slug'  => 'edit.php?post_type=shop_coupon',
						'callback'   => null,
						'position'   => 5,
					),
					'add_coupon'  => array(
						'parent'     => 'power_coupons_settings',
						'page_title' => __( 'Add coupon', 'power-coupons' ),
						'menu_title' => __( 'Add coupon', 'power-coupons' ),
						'capability' => 'edit_shop_coupons',
						'menu_slug'  => 'post-new.php?post_type=shop_coupon',
						'callback'   => null,
						'position'   => 10,
					),
					'bogo'        => ! defined( 'POWER_COUPONS_PRO_VERSION' ) ? array(
						'parent'     => 'power_coupons_settings',
						'page_title' => __( 'BOGO Offers', 'power-coupons' ),
						'menu_title' => __( 'BOGO Offers', 'power-coupons' ),
						'capability' => 'manage_options',
						'menu_slug'  => 'power_coupons_settings&path=bogo',
						'callback'   => array( $this, 'render_settings_page' ),
						'position'   => 12,
					) : null,
					'settings'    => array(
						'parent'     => 'power_coupons_settings',
						'page_title' => __( 'Settings', 'power-coupons' ),
						'menu_title' => __( 'Settings', 'power-coupons' ),
						'capability' => 'manage_options',
						'menu_slug'  => 'power_coupons_settings&path=settings',
						'callback'   => array( $this, 'render_settings_page' ),
						'position'   => 15,
					),
					// Only while setup is unfinished — the wizard's exit dialog
					// promises this entry exists to come back to.
					'resume'      => 'yes' !== get_option( 'power_coupons_is_onboarding_complete', 'no' ) ? array(
						'parent'     => 'power_coupons_settings',
						'page_title' => __( 'Resume Setup', 'power-coupons' ),
						'menu_title' => __( 'Resume Setup', 'power-coupons' ),
						'capability' => 'manage_options',
						'menu_slug'  => self::get_onboarding_url(),
						'callback'   => null,
						'position'   => 20,
					) : null,
					'upgrade'     => ! defined( 'POWER_COUPONS_PRO_VERSION' ) ? array(
						'parent'     => 'power_coupons_settings',
						'page_title' => __( 'Upgrade to Pro', 'power-coupons' ),
						'menu_title' => __( 'Upgrade to Pro', 'power-coupons' ),
						'capability' => 'manage_options',
						'menu_slug'  => self::UPGRADE_URL,
						'callback'   => null,
						'position'   => 999,
					) : null,
				),
			),
			self::get_instance(),
		);

		$menus    = $menu_items['menu'];
		$submenus = array_filter( $menu_items['submenu'] );

		/**
		 * Sort menus by position
		 */
		uasort(
			$menus,
			function( $a, $b ) {
				return ( $a['position'] ?? 0 ) <=> ( $b['position'] ?? 0 );
			}
		);

		/**
		 * Sort submenus by position
		 */
		uasort(
			$submenus,
			function( $a, $b ) {
				return ( $a['position'] ?? 0 ) <=> ( $b['position'] ?? 0 );
			}
		);

		// Add main menu.
		foreach ( $menus as $menu ) {
			add_menu_page(
				$menu['page_title'],
				$menu['menu_title'],
				$menu['capability'],
				$menu['menu_slug'],
				$menu['callback'],
				$menu['icon'],
				$menu['position']
			);
		}

		// Add submenu items.
		foreach ( $submenus as $submenu ) {
			add_submenu_page(
				$submenu['parent'],
				$submenu['page_title'],
				$submenu['menu_title'],
				$submenu['capability'],
				$submenu['menu_slug'],
				$submenu['callback'],
				$submenu['position']
			);
		}

		remove_submenu_page( 'power_coupons_settings', 'power_coupons_settings' );
	}

	/**
	 * Enqueue settings page assets
	 *
	 * @param string $hook Current admin page hook.
	 * @since 1.0.0
	 * @return void
	 */
	public function enqueue_settings_assets( $hook ) {
		if ( 'toplevel_page_power_coupons_settings' !== $hook ) {
			return;
		}

		// Get build asset file.
		$build_file = POWER_COUPONS_DIR . 'admin/assets/build/settings/index.asset.php';
		$asset_file = file_exists( $build_file )
			? require $build_file
			: array(
				'dependencies' => array( 'react', 'react-dom', 'wp-element', 'wp-i18n', 'wp-api-fetch' ),
				'version'      => POWER_COUPONS_VERSION,
			);

		// Load Google Fonts for admin UI (disclosed in readme.txt - Third-Party Services section).
		wp_enqueue_style( 'power-coupons-font', 'https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600&display=swap', array(), '1.0.0' );

		// Enqueue Settings app CSS.
		wp_enqueue_style(
			'power-coupons-settings',
			POWER_COUPONS_URL . 'admin/assets/build/settings/index.css',
			array(),
			$asset_file['version']
		);

		// Enqueue Settings app JS.
		wp_enqueue_script(
			'power-coupons-settings',
			POWER_COUPONS_URL . 'admin/assets/build/settings/index.js',
			$asset_file['dependencies'],
			$asset_file['version'],
			true
		);

		// Get current settings.
		$settings = $this->get_settings();

		// Localize script with settings data.
		$is_onboarding = self::is_admin_onboarding_screen();

		$localize_data = array(
			'ajax_url'               => admin_url( 'admin-ajax.php' ),
			'update_nonce'           => wp_create_nonce( 'power_coupons_update_settings' ),
			'version'                => POWER_COUPONS_VERSION,
			'settings_tabs'          => $this->get_settings_tabs(),
			'settings_fields'        => $this->get_settings_fields(),
			'settings_icons'         => $this->get_settings_icons(),
			'power_coupons_settings' => $settings,
			'coupon_templates'       => Power_Coupons_Utilities::get_coupon_card_templates_array(),
			'coupon_template_labels' => Power_Coupons_Utilities::get_coupon_card_template_labels(),
			'admin_header_menus'     => $this->get_admin_header_menus(),
			'is_pro_active'          => defined( 'POWER_COUPONS_PRO_VERSION' ),
			'is_pro_installed'       => file_exists( WP_PLUGIN_DIR . '/power-coupons-pro/power-coupons-pro.php' ),
			'activate_pro_nonce'     => wp_create_nonce( 'power_coupons_activate_pro' ),
			'onboarding'             => array(
				'inProgress'     => $is_onboarding,
				'ajaxUrl'        => add_query_arg(
					array(
						'action' => 'power_coupons_complete_onboarding',
						'nonce'  => wp_create_nonce( 'power_coupons_onboarding_nonce' ),
					),
					admin_url( 'admin-ajax.php' )
				),
				'skipUrl'        => add_query_arg(
					array(
						'action' => 'power_coupons_onboarding_skipped',
						'nonce'  => wp_create_nonce( 'power_coupons_onboarding_skip_nonce' ),
					),
					admin_url( 'admin-ajax.php' )
				),
				'installUrl'     => add_query_arg(
					array(
						'action' => 'power_coupons_install_plugin',
						'nonce'  => wp_create_nonce( 'power_coupons_install_plugin_nonce' ),
					),
					admin_url( 'admin-ajax.php' )
				),
				'defaults'       => $this->get_onboarding_defaults(),
				'plugins_status' => $this->get_recommended_plugins_status(),
				'links'          => self::get_onboarding_links(),
				'couponCount'    => self::get_coupon_count(),
			),
		);

		$localize_data = apply_filters( 'power_coupons_filter_admin_localize_data', $localize_data );

		// Inject PRO data into settings state so React components can access via useStateValue().
		if ( ! empty( $localize_data['pro_version'] ) ) {
			$localize_data['power_coupons_settings']['pro_version']    = $localize_data['pro_version'];
			$localize_data['power_coupons_settings']['license_status'] = $localize_data['license_status'] ?? '';
		}

		wp_localize_script( 'power-coupons-settings', 'powerCouponsSettings', $localize_data );

		// Hide admin bar and sidebar during onboarding for a clean full-screen experience.
		if ( $is_onboarding ) {
			$onboarding_css = '
				html.wp-toolbar {
					padding: 0;
				}
				#wpcontent {
					margin: 0;
					padding: 0;
				}
				#wpadminbar, #adminmenumain {
					display: none;
				}
			';
			wp_add_inline_style( 'power-coupons-settings', $onboarding_css );
		}
	}

	/**
	 * Get admin header menus.
	 *
	 * @return array
	 */
	private function get_admin_header_menus() {

		$menus = [
			[
				'name'     => __( 'Settings', 'power-coupons' ),
				'path'     => 'settings',
				'position' => 10,
			],
		];

		// Show BOGO tab as upsell when PRO is not active.
		if ( ! defined( 'POWER_COUPONS_PRO_VERSION' ) ) {
			$menus[] = [
				'name'     => __( 'BOGO Offers', 'power-coupons' ),
				'path'     => 'bogo',
				'position' => 5,
			];
		}

		/**
		 * Filter admin header menus.
		 */
		$menus = apply_filters(
			'power_coupons_filter_admin_header_menus',
			$menus
		);

		// Sort menus by position (default to 999 if not set).
		usort(
			$menus,
			function( $a, $b ) {

				$pos_a = isset( $a['position'] ) ? (int) $a['position'] : 999;
				$pos_b = isset( $b['position'] ) ? (int) $b['position'] : 999;

				return $pos_a <=> $pos_b;
			}
		);

		return $menus;
	}


	/**
	 * Render settings page
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function render_settings_page() {
		?>
		<div id="power-coupons-settings"></div>
		<?php
	}

	/**
	 * Get settings with defaults
	 *
	 * @since 1.0.0
	 * @return array
	 */
	public function get_settings() {
		$defaults = Power_Coupons_Settings_Helper::get_default_settings();

		$saved_settings = get_option( self::OPTION_KEY, array() );

		// Merge each section separately to preserve structure.
		$settings = array();
		foreach ( $defaults as $section => $section_defaults ) {
			$settings[ $section ] = isset( $saved_settings[ $section ] ) && is_array( $saved_settings[ $section ] )
			? wp_parse_args( $saved_settings[ $section ], $section_defaults )
			: $section_defaults;
		}

		return $settings;
	}

	/**
	 * Get settings tabs
	 *
	 * @since 1.0.0
	 * @return array
	 */
	private function get_settings_tabs() {
		$tabs = array(
			'power_coupons_general'        => array(
				'name'     => __( 'General', 'power-coupons' ),
				'label'    => __( 'General', 'power-coupons' ),
				'slug'     => 'power_coupons_general',
				'priority' => 20,
			),
			'power_coupons_coupon_styling' => array(
				'name'     => __( 'Coupon Styling', 'power-coupons' ),
				'label'    => __( 'Coupon Styling', 'power-coupons' ),
				'slug'     => 'power_coupons_coupon_styling',
				'priority' => 30,
			),
			'power_coupons_text'           => array(
				'name'     => __( 'Text Customization', 'power-coupons' ),
				'label'    => __( 'Text Customization', 'power-coupons' ),
				'slug'     => 'power_coupons_text',
				'priority' => 60,
				'subtabs'  => array(
					array(
						'slug'  => 'general',
						'title' => __( 'General', 'power-coupons' ),
					),
					array(
						'slug'  => 'loyalty_rewards',
						'title' => __( 'Loyalty Rewards', 'power-coupons' ),
					),
					array(
						'slug'  => 'gift_cards',
						'title' => __( 'Gift Cards', 'power-coupons' ),
					),
				),
			),
		);

		// When PRO is not active, register PRO-only tabs as upsell placeholders so
		// users can browse them and see a "Go Pro" nudge instead.
		if ( ! defined( 'POWER_COUPONS_PRO_VERSION' ) ) {
			$tabs['power_coupons_cart_progress_bar'] = array(
				'name'          => __( 'Cart Progress Bar', 'power-coupons' ),
				'label'         => __( 'Cart Progress Bar', 'power-coupons' ),
				'slug'          => 'power_coupons_cart_progress_bar',
				'priority'      => 40,
				'is_pro_upsell' => true,
			);
			$tabs['power_coupons_points']            = array(
				'name'          => __( 'Loyalty Rewards', 'power-coupons' ),
				'label'         => __( 'Loyalty Rewards', 'power-coupons' ),
				'slug'          => 'power_coupons_points',
				'priority'      => 50,
				'is_pro_upsell' => true,
			);
			$tabs['power_coupons_gift_cards']        = array(
				'name'          => __( 'Gift Cards', 'power-coupons' ),
				'label'         => __( 'Gift Cards', 'power-coupons' ),
				'slug'          => 'power_coupons_gift_cards',
				'priority'      => 55,
				'is_pro_upsell' => true,
			);
		}

		return apply_filters( 'power_coupons_filter_settings_tabs', $tabs );
	}

	/**
	 * Get settings fields
	 *
	 * @since 1.0.0
	 * @return array
	 */
	private function get_settings_fields() {
		$fields = array(
			'power_coupons_general'        => $this->get_general_fields(),
			'power_coupons_coupon_styling' => $this->get_coupon_styling_fields(),
			'power_coupons_text'           => $this->get_text_fields(),
		);

		return apply_filters( 'power_coupons_filter_settings_fields', $fields );
	}

	/**
	 * Get general tab fields
	 *
	 * @since 1.0.0
	 * @return array
	 */
	private function get_general_fields() {
		$fields = array(
			// Plugin Status — the master switch, on its own so it does not read
			// as one more cosmetic toggle in a list of seven.
			array(
				'name'            => 'general[enable_plugin]',
				'label'           => __( 'Enable Plugin', 'power-coupons' ),
				'description'     => __( 'Turn Power Coupons on or off across your whole store. With this off, no coupons are shown or applied anywhere.', 'power-coupons' ),
				'type'            => 'toggle',
				'section'         => 'core',
				'section_title'   => __( 'Plugin Status', 'power-coupons' ),
				'confirm_off'     => true,
				'confirm_title'   => __( 'Turn off Power Coupons?', 'power-coupons' ),
				'confirm_message' => __( 'Coupons will stop being shown and applied across your store immediately, including for customers currently checking out.', 'power-coupons' ),
				'confirm_label'   => __( 'Turn Off', 'power-coupons' ),
			),
			// Where Coupons Appear.
			array(
				'name'          => 'general[show_on_cart]',
				'label'         => __( 'Show on Cart', 'power-coupons' ),
				'description'   => __( 'Display available coupons on the cart page.', 'power-coupons' ),
				'type'          => 'toggle',
				'section'       => 'visibility',
				'section_title' => __( 'Where Coupons Appear', 'power-coupons' ),
			),
			array(
				'name'        => 'general[show_on_checkout]',
				'label'       => __( 'Show on Checkout', 'power-coupons' ),
				'description' => __( 'Display available coupons on the checkout page.', 'power-coupons' ),
				'type'        => 'toggle',
				'section'     => 'visibility',
			),
			array(
				'name'        => 'general[enable_for_guests]',
				'label'       => __( 'Enable for Guests', 'power-coupons' ),
				'description' => __( 'Let shoppers who are not logged in see and use coupons.', 'power-coupons' ),
				'type'        => 'toggle',
				'section'     => 'visibility',
			),
			// What Customers See.
			array(
				'name'          => 'general[show_applied_coupons]',
				'label'         => __( 'Show Applied Coupons', 'power-coupons' ),
				'description'   => __( 'List the coupons already applied to the current cart.', 'power-coupons' ),
				'type'          => 'toggle',
				'section'       => 'display',
				'section_title' => __( 'What Customers See', 'power-coupons' ),
			),
			array(
				'name'        => 'general[show_expiry_info]',
				'label'       => __( 'Show Expiry Info', 'power-coupons' ),
				'description' => __( 'Show each coupon\'s expiry date and countdown.', 'power-coupons' ),
				'type'        => 'toggle',
				'section'     => 'display',
			),
			array(
				'name'          => 'general[enable_usage_tracking]',
				'label'         => __( 'Help Us Improve Your Experience', 'power-coupons' ),
				'description'   => sprintf(
					/* translators: %1$s: link html start, %2$s: link html end. */
					__( 'Allow Power Coupons and our other products to track non-sensitive usage tracking data. %1$sLearn More%2$s', 'power-coupons' ),
					'<a href="https://store.brainstormforce.com/usage-tracking/?utm_source=dashboard&utm_medium=power-coupons&utm_campaign=docs" class="text-wpcolor hover:text-wphovercolor no-underline" target="_blank" rel="noopener noreferrer">',
					'</a>'
				),
				'type'          => 'toggle',
				'section'       => 'privacy',
				'section_title' => __( 'Privacy', 'power-coupons' ),
			),
		);

		return apply_filters( 'power_coupons_filter_general_fields', $fields );
	}

	/**
	 * Get coupon styling fields configuration.
	 *
	 * @return array Array of styling field configurations.
	 */
	private function get_coupon_styling_fields() {
		return array(
			array(
				'name'        => 'coupon_styling[coupon_style]',
				'label'       => __( 'Choose Coupon Styling', 'power-coupons' ),
				'description' => __( 'Select a visual style template for how your coupons will be displayed to customers.', 'power-coupons' ),
				'type'        => 'coupon_template_picker',
			),
		);
	}

	/**
	 * Get text customization tab fields
	 *
	 * @since 1.0.0
	 * @return array
	 */
	private function get_text_fields() {
		return array(
			array(
				'name'          => 'text[drawer_heading]',
				'label'         => __( 'Drawer Heading', 'power-coupons' ),
				'description'   => __( 'Title shown at the top of the coupon drawer.', 'power-coupons' ),
				'type'          => 'text',
				'subtab'        => 'general',
				'section'       => 'drawer',
				'section_title' => __( 'Coupon Drawer', 'power-coupons' ),
			),
			array(
				'name'        => 'text[trigger_button_label]',
				'label'       => __( 'Drawer Trigger Button Label', 'power-coupons' ),
				'description' => __( 'Label on the button customers click to open the drawer.', 'power-coupons' ),
				'type'        => 'text',
				'subtab'      => 'general',
				'section'     => 'drawer',
			),
			array(
				'name'        => 'text[coupons_loading_text]',
				'label'       => __( 'Coupons Loading Text', 'power-coupons' ),
				'description' => __( 'Shown while the drawer is still fetching coupons.', 'power-coupons' ),
				'type'        => 'text',
				'subtab'      => 'general',
				'section'     => 'drawer',
			),
			array(
				'name'          => 'text[coupon_applying_text]',
				'label'         => __( 'Coupon Applying Text', 'power-coupons' ),
				'description'   => __( 'Shown while a coupon is being applied to the cart.', 'power-coupons' ),
				'type'          => 'text',
				'subtab'        => 'general',
				'section'       => 'feedback',
				'section_title' => __( 'Coupon Feedback', 'power-coupons' ),
			),
			array(
				'name'        => 'text[coupon_applied_text]',
				'label'       => __( 'Coupon Applied Text', 'power-coupons' ),
				'description' => __( 'Shown once a coupon has been applied successfully.', 'power-coupons' ),
				'type'        => 'text',
				'subtab'      => 'general',
				'section'     => 'feedback',
			),
			array(
				'name'        => 'text[no_coupons_text]',
				'label'       => __( 'No Coupons Text', 'power-coupons' ),
				'description' => __( 'Shown when no coupons are available for the current cart.', 'power-coupons' ),
				'type'        => 'text',
				'subtab'      => 'general',
				'section'     => 'feedback',
			),
		);
	}

	/**
	 * Get settings icons
	 *
	 * @since 1.0.0
	 * @return array
	 */
	private function get_settings_icons() {
		$icons = array(
			'power_coupons_coupon_styling' => '<svg width="18" height="13" viewBox="0 0 18 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 1.25V1.875M12.5 4.375V5M12.5 7.5V8.125M12.5 10.625V11.25M5 6.875H9.375M5 8.75H7.5M1.5625 0.625C1.04473 0.625 0.625 1.04473 0.625 1.5625V4.08446C1.37225 4.51672 1.875 5.32465 1.875 6.25C1.875 7.17535 1.37225 7.98328 0.625 8.41554V10.9375C0.625 11.4553 1.04473 11.875 1.5625 11.875H15.9375C16.4553 11.875 16.875 11.4553 16.875 10.9375V8.41554C16.1277 7.98328 15.625 7.17535 15.625 6.25C15.625 5.32465 16.1277 4.51672 16.875 4.08446V1.5625C16.875 1.04473 16.4553 0.625 15.9375 0.625H1.5625Z" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>',
			'power_coupons_general'        => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>',
			'power_coupons_text'           => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>',
		);

		// Include PRO tab icons as upsell placeholders when PRO is not active.
		if ( ! defined( 'POWER_COUPONS_PRO_VERSION' ) ) {
			$icons['power_coupons_cart_progress_bar'] = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>';
			$icons['power_coupons_points']            = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>';
			$icons['power_coupons_gift_cards']        = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>';
		}

		return $icons;
	}

	/**
	 * AJAX handler for updating settings
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function ajax_update_settings() {
		check_ajax_referer( 'power_coupons_update_settings', 'security' );

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied', 'power-coupons' ) ) );
		}

		// Validate and decode JSON settings.
		$settings = array();
		if ( isset( $_POST['power_coupons_settings'] ) ) {
			$raw_settings = isset( $_POST['power_coupons_settings'] ) ? wp_unslash( $_POST['power_coupons_settings'] ) : ''; // phpcs:ignore -- We are sanitizing it below.
			$decoded      = json_decode( $raw_settings, true );

			// Check for JSON errors.
			if ( json_last_error() !== JSON_ERROR_NONE ) {
				wp_send_json_error(
					array(
						'message' => __( 'Invalid settings data format.', 'power-coupons' ),
					)
				);
				return;
			}

			// Ensure decoded data is an array.
			if ( ! is_array( $decoded ) ) {
				wp_send_json_error(
					array(
						'message' => __( 'Invalid settings data format.', 'power-coupons' ),
					)
				);
				return;
			}

			$settings = $decoded;
		}

		// Sanitize settings by section.
		$sanitized = array(
			'general'           => $this->sanitize_general_settings( $settings['general'] ?? array() ),
			'coupon_styling'    => $this->sanitize_coupon_styling_settings( $settings['coupon_styling'] ?? array() ),
			'text'              => $this->sanitize_text_settings( $settings['text'] ?? array() ),
			'cart_progress_bar' => $this->sanitize_cart_progress_bar_settings( $settings['cart_progress_bar'] ?? array() ),
		);

		/**
		 * Filter the sanitized settings immediately before they are stored.
		 *
		 * This handler knows only the four sections the free plugin owns, and it
		 * writes `power_coupons_settings` as a whole rather than merging. An
		 * add-on that contributes fields through
		 * `power_coupons_filter_settings_fields` receives its values in the
		 * request but has no way to persist them without this hook.
		 *
		 * Pro does not need it — each Pro module owns its own option and hooks
		 * this same AJAX action at priority 5 — but nothing else has that option
		 * available, so a merge on its own would not be enough anyway.
		 *
		 * Whatever a callback adds here is written to the database as-is, so it
		 * must sanitize its own section.
		 *
		 * @since 1.0.7
		 *
		 * @param array<string, mixed> $sanitized Sanitized settings about to be saved.
		 * @param array<string, mixed> $settings  Raw decoded settings from the request.
		 */
		$filtered = apply_filters( 'power_coupons_filter_sanitized_settings', $sanitized, $settings );

		// A callback that returns the wrong shape must not be able to wipe the
		// option; fall back to what this handler sanitized itself.
		if ( is_array( $filtered ) ) {
			$sanitized = $filtered;
		}

		update_option( self::OPTION_KEY, $sanitized );

		wp_send_json_success( array( 'message' => __( 'Settings saved successfully', 'power-coupons' ) ) );
	}

	/**
	 * AJAX handler for activating Power Coupons Pro plugin.
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function ajax_activate_pro() {
		check_ajax_referer( 'power_coupons_activate_pro', 'security' );

		if ( ! current_user_can( 'activate_plugins' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'power-coupons' ) ) );
		}

		$plugin = 'power-coupons-pro/power-coupons-pro.php';

		if ( ! file_exists( WP_PLUGIN_DIR . '/' . $plugin ) ) {
			wp_send_json_error( array( 'message' => __( 'Power Coupons Pro is not installed.', 'power-coupons' ) ) );
		}

		if ( is_plugin_active( $plugin ) ) {
			wp_send_json_success( array( 'message' => __( 'Power Coupons Pro is already active.', 'power-coupons' ) ) );
		}

		$result = activate_plugin( $plugin );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		wp_send_json_success( array( 'message' => __( 'Power Coupons Pro activated successfully.', 'power-coupons' ) ) );
	}

	/**
	 * Sanitize general settings
	 *
	 * @param array $settings General settings to sanitize.
	 * @return array Sanitized settings.
	 */
	private function sanitize_general_settings( $settings ) {
		return array(
			'enable_plugin'         => ! empty( $settings['enable_plugin'] ),
			'show_on_cart'          => ! empty( $settings['show_on_cart'] ),
			'show_on_checkout'      => ! empty( $settings['show_on_checkout'] ),
			'enable_for_guests'     => ! empty( $settings['enable_for_guests'] ),
			'hide_wc_coupon_field'  => ! empty( $settings['hide_wc_coupon_field'] ),
			'show_applied_coupons'  => ! empty( $settings['show_applied_coupons'] ),
			'show_expiry_info'      => ! empty( $settings['show_expiry_info'] ),
			'enable_usage_tracking' => ! empty( $settings['enable_usage_tracking'] ),
			'coupon_display_mode'   => in_array( $settings['coupon_display_mode'] ?? 'drawer', array( 'drawer', 'modal' ), true )
				? sanitize_text_field( $settings['coupon_display_mode'] )
				: 'drawer',
		);
	}

	/**
	 * Sanitize text settings
	 *
	 * @param array $settings Text settings to sanitize.
	 * @return array Sanitized settings.
	 */
	private function sanitize_text_settings( $settings ) {
		$text_fields = array(
			'drawer_heading',
			'trigger_button_label',
			'coupon_applying_text',
			'coupon_applied_text',
			'no_coupons_text',
			'coupons_loading_text',
		);

		$sanitized = array();
		foreach ( $text_fields as $field ) {
			$sanitized[ $field ] = isset( $settings[ $field ] ) ? sanitize_text_field( $settings[ $field ] ) : '';
		}

		return $sanitized;
	}

	/**
	 * Sanitize coupon styling settings
	 *
	 * @param array $settings Coupon styling settings to sanitize.
	 * @return array Sanitized settings.
	 */
	private function sanitize_coupon_styling_settings( $settings ) {
		return array(
			'coupon_style' => sanitize_text_field( $settings['coupon_style'] ?? 'style-1' ),
		);
	}

	/**
	 * Sanitize cart progress bar settings
	 *
	 * @param array $settings Cart progress bar settings to sanitize.
	 * @return array Sanitized settings.
	 */
	private function sanitize_cart_progress_bar_settings( $settings ) {
		$bar_color     = sanitize_hex_color( $settings['bar_color'] ?? '#f97316' );
		$bar_bg_color  = sanitize_hex_color( $settings['bar_bg_color'] ?? '#e5e7eb' );
		$success_color = sanitize_hex_color( $settings['success_color'] ?? '#16a34a' );

		$sanitized = array(
			'enable'        => ! empty( $settings['enable'] ),
			'bar_color'     => $bar_color ? $bar_color : '#f97316',
			'bar_bg_color'  => $bar_bg_color ? $bar_bg_color : '#e5e7eb',
			'success_color' => $success_color ? $success_color : '#16a34a',
			'animate'       => isset( $settings['animate'] ) ? (bool) $settings['animate'] : true,
		);

		return $sanitized;
	}

	/**
	 * Check whether the current admin screen is the onboarding page.
	 *
	 * @since 1.0.3
	 * @return bool
	 */
	public static function is_admin_onboarding_screen() {
		if ( empty( $_GET['page'] ) || empty( $_GET['onboarding'] ) || empty( $_GET['nonce'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return false;
		}

		if ( 'power_coupons_settings' !== sanitize_key( wp_unslash( $_GET['page'] ) ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return false;
		}

		if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['nonce'] ) ), 'power_coupons_onboarding_nonce' ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Build the URL that opens the guided setup wizard.
	 *
	 * The nonce is bound to the current user's session, so this has to be built
	 * per request rather than stored.
	 *
	 * @since 1.0.8
	 * @return string
	 */
	public static function get_onboarding_url() {
		return add_query_arg(
			array(
				'page'       => 'power_coupons_settings',
				'nonce'      => wp_create_nonce( 'power_coupons_onboarding_nonce' ),
				'onboarding' => 1,
			),
			admin_url( 'admin.php' )
		);
	}

	/**
	 * How many coupons this store already has.
	 *
	 * The success screen used to offer "Create your first coupon" and "Review
	 * your existing coupons" side by side, which cannot both be the next thing
	 * to do. Drafts count: a merchant who started one has not got a first
	 * coupon left to create.
	 *
	 * @since 1.0.8
	 * @return int
	 */
	public static function get_coupon_count() {
		$counts = wp_count_posts( 'shop_coupon' );

		if ( ! is_object( $counts ) ) {
			return 0;
		}

		$total = 0;

		foreach ( array( 'publish', 'draft', 'pending', 'private', 'future' ) as $status ) {
			$total += (int) ( $counts->{$status} ?? 0 );
		}

		return $total;
	}

	/**
	 * Destinations the wizard links to.
	 *
	 * Resolved server-side so the React app never has to guess an admin slug or
	 * a store URL.
	 *
	 * @since 1.0.8
	 * @return array<string, string>
	 */
	public static function get_onboarding_links() {
		return array(
			'newCoupon'  => admin_url( 'post-new.php?post_type=shop_coupon' ),
			'allCoupons' => admin_url( 'edit.php?post_type=shop_coupon' ),
			'settings'   => admin_url( 'admin.php?page=power_coupons_settings&path=settings' ),
			'textLabels' => admin_url( 'admin.php?page=power_coupons_settings&path=settings&tab=power_coupons_text' ),
			'dashboard'  => admin_url( 'admin.php?page=power_coupons_settings' ),
			'docs'       => 'https://cartflows.com/docs-category/power-coupons-for-woocommerce/',
		);
	}

	/**
	 * Open the wizard on the first admin load after activation.
	 *
	 * The activation transient has been set since 1.0.0 but nothing ever read
	 * it, so the wizard only opened for anyone who happened to build the URL by
	 * hand.
	 *
	 * @since 1.0.8
	 * @return void
	 */
	public function maybe_redirect_to_onboarding() {
		if ( wp_doing_ajax() || wp_doing_cron() || is_network_admin() ) {
			return;
		}

		if ( ! get_transient( 'power_coupons_redirect_to_onboarding' ) ) {
			return;
		}

		// One shot, whether or not the redirect below actually happens.
		delete_transient( 'power_coupons_redirect_to_onboarding' );

		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Never interrupt a bulk plugin action — the merchant is mid-task.
		if ( isset( $_GET['activate-multi'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}

		if ( 'yes' === get_option( 'power_coupons_is_onboarding_complete', 'no' ) ) {
			return;
		}

		// Exiting the wizard does not complete it — the merchant can still resume from
		// the submenu — but it does mean they have said no once already.
		if ( 'yes' === get_option( 'power_coupons_onboarding_dismissed', 'no' ) ) {
			return;
		}

		wp_safe_redirect( self::get_onboarding_url() );
		exit;
	}

	/**
	 * Get onboarding default values.
	 *
	 * @since 1.0.3
	 * @return array<int, array<string, mixed>>
	 */
	private function get_onboarding_defaults() {
		$current_user = wp_get_current_user();

		return array(
			1 => array(
				'coupon_style'      => 'style-1',
				'show_on_cart'      => true,
				'show_on_checkout'  => true,
				'enable_for_guests' => true,
			),
			2 => array(
				'user_detail_firstname' => $current_user->first_name,
				'user_detail_lastname'  => $current_user->last_name,
				'user_detail_email'     => $current_user->user_email,
				'optin_usage_tracking'  => false,
			),
			// Recommended add-ons are pre-selected; the merchant unticks what
			// they don't want on the add-ons step.
			3 => array(
				'cartflows'                     => true,
				'modern-cart'                   => true,
				'woo-cart-abandonment-recovery' => true,
				'sureforms'                     => true,
				'surerank'                      => true,
			),
		);
	}

	/**
	 * Get install/active status for the recommended onboarding plugins.
	 *
	 * @since 1.0.7
	 * @return array<string, string> Map of plugin slug to 'active', 'inactive', or 'not-installed'.
	 */
	private function get_recommended_plugins_status() {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$installed_plugins = get_plugins();
		$statuses          = array();

		foreach ( array_keys( $this->get_onboarding_defaults()[3] ?? array() ) as $slug ) {
			$status = 'not-installed';

			foreach ( $installed_plugins as $plugin_file => $plugin_data ) {
				if ( 0 === strpos( $plugin_file, $slug . '/' ) ) {
					$status = is_plugin_active( $plugin_file ) ? 'active' : 'inactive';
					break;
				}
			}

			$statuses[ $slug ] = $status;
		}

		return $statuses;
	}

	/**
	 * Map onboarding key to original settings key.
	 *
	 * @since 1.0.3
	 * @param string $key   Onboarding field key.
	 * @param mixed  $value Field value.
	 * @return array{section: string, key: string, value: mixed}|null
	 */
	private function map_onboarding_key_to_original_key( $key, $value ) {
		switch ( $key ) {
			case 'coupon_style':
				return array(
					'section' => 'coupon_styling',
					'key'     => 'coupon_style',
					'value'   => sanitize_text_field( $value ),
				);

			case 'show_on_cart':
				return array(
					'section' => 'general',
					'key'     => 'show_on_cart',
					'value'   => (bool) $value,
				);

			case 'show_on_checkout':
				return array(
					'section' => 'general',
					'key'     => 'show_on_checkout',
					'value'   => (bool) $value,
				);

			case 'enable_for_guests':
				return array(
					'section' => 'general',
					'key'     => 'enable_for_guests',
					'value'   => (bool) $value,
				);

			case 'optin_usage_tracking':
				return array(
					'section' => 'general',
					'key'     => 'enable_usage_tracking',
					'value'   => (bool) $value,
				);

			default:
				return null;
		}
	}

	/**
	 * AJAX handler for completing onboarding.
	 *
	 * @since 1.0.3
	 * @return void
	 */
	public function complete_onboarding() {
		if ( ! isset( $_GET['nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['nonce'] ) ), 'power_coupons_onboarding_nonce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Nonce verification failed.', 'power-coupons' ) ) );
		}

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'power-coupons' ) ) );
		}

		$raw_input       = file_get_contents( 'php://input' );
		$onboarding_data = is_string( $raw_input ) ? json_decode( $raw_input, true ) : null;

		if ( empty( $onboarding_data ) || ! is_array( $onboarding_data ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid data.', 'power-coupons' ) ) );
		}

		// Get current settings as base.
		$settings = $this->get_settings();

		$installable_plugin_slugs = array();
		$user_details_data        = array();

		foreach ( $onboarding_data as $index => $data ) {
			if ( ! is_array( $data ) ) {
				continue;
			}

			if ( isset( $data['hasSkipped'] ) ) {
				continue;
			}

			foreach ( $data as $key => $value ) {
				if ( ! is_string( $key ) ) {
					continue;
				}

				// Map settings from step 1.
				$mapped = $this->map_onboarding_key_to_original_key( $key, $value );
				if ( $mapped ) {
					$settings[ $mapped['section'] ][ $mapped['key'] ] = $mapped['value'];
				}

				// Collect user details from step 2.
				if ( 2 === (int) $index && is_scalar( $value ) ) {
					$user_details_data[ sanitize_key( $key ) ] = sanitize_text_field( wp_unslash( (string) $value ) );
				}

				// Collect plugin slugs from step 3.
				if ( 3 === (int) $index && (bool) $value ) {
					$allowed_slugs = array_keys( $this->get_onboarding_defaults()[3] ?? array() );
					if ( in_array( $key, $allowed_slugs, true ) ) {
						$installable_plugin_slugs[] = $key;
					}
				}
			}
		}

		// Send user details to webhook.
		if ( ! empty( $user_details_data ) ) {
			$encoded_body = wp_json_encode( $user_details_data );
			wp_remote_post(
				POWER_COUPONS_ONBOARDING_USER_SUB_WORKFLOW_URL,
				array(
					'body'    => $encoded_body ? $encoded_body : '',
					'headers' => array(
						'Content-Type' => 'application/json',
					),
				)
			);
		}

		// Save settings.
		update_option( self::OPTION_KEY, $settings );

		// Install selected plugins.
		if ( ! empty( $installable_plugin_slugs ) ) {
			self::install_wordpress_plugins( $installable_plugin_slugs );
		}

		// Mark onboarding as complete.
		update_option( 'power_coupons_is_onboarding_complete', 'yes' );

		// A merchant who exited and then came back and finished is a completion, not a
		// skip. Analytics reads `onboarding_completed` as "complete and never skipped",
		// so leaving this behind would report them as skipped for good and never as
		// completed at all.
		delete_option( 'power_coupons_onboarding_skipped' );
		delete_option( 'power_coupons_onboarding_dismissed' );

		wp_send_json_success();
	}

	/**
	 * AJAX handler for onboarding skipped.
	 *
	 * Saves which step the user exited at for analytics tracking.
	 *
	 * @since 1.0.3
	 * @return void
	 */
	public function ajax_onboarding_skipped() {
		if ( ! isset( $_GET['nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['nonce'] ) ), 'power_coupons_onboarding_skip_nonce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Nonce verification failed.', 'power-coupons' ) ) );
		}

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'power-coupons' ) ) );
		}

		$raw_input = file_get_contents( 'php://input' );
		$data      = is_string( $raw_input ) ? json_decode( $raw_input, true ) : null;
		$exit_step = is_array( $data ) && isset( $data['exit_step'] ) ? sanitize_text_field( $data['exit_step'] ) : '';

		update_option(
			'power_coupons_onboarding_skipped',
			array( 'exit_step' => $exit_step )
		);

		// Exiting pauses the wizard, it does not finish it. Marking onboarding
		// complete here meant a single stray click ended setup permanently with
		// no way back. Completion is only recorded by complete_onboarding().
		//
		// It does have to be remembered, though: the activation redirect is armed
		// whenever onboarding is incomplete, so without this every reactivation
		// would reopen the wizard for someone who had already left it. The Resume
		// Setup submenu stays, so nothing is lost.
		update_option( 'power_coupons_onboarding_dismissed', 'yes' );

		wp_send_json_success();
	}

	/**
	 * AJAX handler for installing one recommended plugin.
	 *
	 * The wizard installs the plugins it was given one at a time so the merchant
	 * can watch each row change state, instead of staring at a disabled button
	 * while a single request works through the whole list.
	 *
	 * @since 1.0.8
	 * @return void
	 */
	public function ajax_install_plugin() {
		if ( ! isset( $_GET['nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['nonce'] ) ), 'power_coupons_install_plugin_nonce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Nonce verification failed.', 'power-coupons' ) ) );
		}

		if ( ! current_user_can( 'install_plugins' ) || ! current_user_can( 'activate_plugins' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'power-coupons' ) ) );
		}

		$raw_input = file_get_contents( 'php://input' );
		$payload   = is_string( $raw_input ) ? json_decode( $raw_input, true ) : null;
		$slug      = is_array( $payload ) && isset( $payload['slug'] ) && is_string( $payload['slug'] ) ? sanitize_key( $payload['slug'] ) : '';

		// Only the plugins this wizard recommends may be installed through it —
		// the slug arrives from the browser and reaches plugins_api().
		$allowed_slugs = array_keys( $this->get_onboarding_defaults()[3] ?? array() );

		if ( '' === $slug || ! in_array( $slug, $allowed_slugs, true ) ) {
			wp_send_json_error( array( 'message' => __( 'That plugin is not part of the guided setup.', 'power-coupons' ) ) );
		}

		$installed = self::install_wordpress_plugin( $slug );

		if ( is_wp_error( $installed ) ) {
			wp_send_json_error(
				array(
					'slug'    => $slug,
					'message' => $installed->get_error_message(),
				)
			);
		}

		wp_send_json_success(
			array(
				'slug'   => $slug,
				'status' => 'active',
			)
		);
	}

	/**
	 * Install WordPress plugins from the repository.
	 *
	 * @since 1.0.3
	 * @param array<string> $plugin_slugs Array of plugin slugs to install.
	 * @return void
	 */
	public static function install_wordpress_plugins( $plugin_slugs ) {
		if ( empty( $plugin_slugs ) || ! is_array( $plugin_slugs ) ) {
			return;
		}

		foreach ( $plugin_slugs as $slug ) {
			self::install_wordpress_plugin( is_string( $slug ) ? $slug : '' );
		}
	}

	/**
	 * Install and activate a single plugin from the WordPress.org repository.
	 *
	 * Already-installed plugins are activated rather than downloaded again, and
	 * an already-active plugin is a no-op success.
	 *
	 * @since 1.0.8
	 * @param string $slug Plugin directory slug.
	 * @return true|WP_Error True once the plugin is active, WP_Error describing the failure.
	 */
	public static function install_wordpress_plugin( $slug ) {
		$slug = sanitize_key( $slug );

		if ( '' === $slug ) {
			return new WP_Error( 'power_coupons_invalid_slug', __( 'No plugin was named.', 'power-coupons' ) );
		}

		require_once ABSPATH . 'wp-admin/includes/plugin.php';
		require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		require_once ABSPATH . 'wp-admin/includes/class-plugin-upgrader.php';

		$plugin_file = self::find_installed_plugin_file( $slug );

		if ( '' === $plugin_file ) {
			// Fetch plugin info from WordPress.org.
			$api = plugins_api(
				'plugin_information',
				array(
					'slug'   => $slug,
					'fields' => array( 'sections' => false ),
				)
			);

			if ( is_wp_error( $api ) ) {
				return $api;
			}

			// Install the plugin silently.
			$upgrader = new \Plugin_Upgrader( new \Automatic_Upgrader_Skin() );
			$result   = $upgrader->install( $api->download_link );

			if ( is_wp_error( $result ) ) {
				return $result;
			}

			if ( true !== $result ) {
				return new WP_Error( 'power_coupons_install_failed', __( 'The plugin could not be downloaded.', 'power-coupons' ) );
			}

			$plugin_file = self::find_installed_plugin_file( $slug );

			if ( '' === $plugin_file ) {
				return new WP_Error( 'power_coupons_install_failed', __( 'The plugin installed but could not be found.', 'power-coupons' ) );
			}
		}

		if ( is_plugin_active( $plugin_file ) ) {
			return true;
		}

		// Activate normally so the plugin's activation hooks run (DB tables, default
		// options, cron schedules). The post-activation redirect those plugins queue is
		// neutralised separately by maybe_reclaim_post_onboarding_redirect().
		$activated = activate_plugin( $plugin_file );
		self::guard_post_onboarding_redirect();

		if ( is_wp_error( $activated ) ) {
			return $activated;
		}

		return true;
	}

	/**
	 * Find the plugin file for an installed plugin slug.
	 *
	 * @since 1.0.8
	 * @param string $slug Plugin directory slug.
	 * @return string Plugin file relative to the plugins directory, or an empty string.
	 */
	private static function find_installed_plugin_file( $slug ) {
		foreach ( array_keys( get_plugins() ) as $plugin_file ) {
			if ( 0 === strpos( $plugin_file, $slug . '/' ) ) {
				return $plugin_file;
			}
		}

		return '';
	}

	/**
	 * Arm the one-shot guard that reclaims the post-onboarding redirect.
	 *
	 * Set after activating a plugin during onboarding. It survives to the next real admin
	 * page load (admin-ajax.php does not redirect), where it is consumed once.
	 *
	 * @since 1.0.6
	 * @return void
	 */
	private static function guard_post_onboarding_redirect() {
		set_transient( 'power_coupons_onboarding_redirect_guard', 1, 15 * MINUTE_IN_SECONDS );
	}

	/**
	 * Reclaim the redirect on the first admin page load after onboarding installs.
	 *
	 * Sibling plugins installed during onboarding queue a post-activation redirect on
	 * admin_init. Instead of skipping their activation hooks (which would leave them
	 * half-installed), we let them run and rewrite any redirect on this single page load
	 * to the Power Coupons dashboard, preserving the plugin's own exit() while keeping the
	 * user on the expected screen. The guard is consumed once so later redirects work normally.
	 *
	 * @since 1.0.6
	 * @return void
	 */
	public function maybe_reclaim_post_onboarding_redirect() {
		// admin-ajax.php fires admin_init on every AJAX request (e.g. WP Heartbeat). Skip
		// those so the one-shot guard isn't consumed before the user's real "Go To Dashboard"
		// page load — the only request where a sibling plugin actually performs its redirect.
		if ( wp_doing_ajax() ) {
			return;
		}

		if ( ! get_transient( 'power_coupons_onboarding_redirect_guard' ) ) {
			return;
		}

		// Consume immediately so this only affects the first page load after onboarding.
		delete_transient( 'power_coupons_onboarding_redirect_guard' );

		add_filter(
			'wp_redirect',
			static function () {
				return admin_url( 'admin.php?page=power_coupons_settings' );
			},
			PHP_INT_MAX
		);
	}

}
