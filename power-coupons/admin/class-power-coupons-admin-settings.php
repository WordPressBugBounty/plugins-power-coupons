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
						'icon'       => 'data:image/svg+xml;base64,' . base64_encode( file_get_contents( POWER_COUPONS_DIR . 'admin/assets/images/logo.svg' ) ), // phpcs:ignore
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
		$localize_data = array(
			'ajax_url'               => admin_url( 'admin-ajax.php' ),
			'update_nonce'           => wp_create_nonce( 'power_coupons_update_settings' ),
			'version'                => POWER_COUPONS_VERSION,
			'settings_tabs'          => $this->get_settings_tabs(),
			'settings_fields'        => $this->get_settings_fields(),
			'settings_icons'         => $this->get_settings_icons(),
			'power_coupons_settings' => $settings,
			'coupon_templates'       => Power_Coupons_Utilities::get_coupon_card_templates_array(),
			'admin_header_menus'     => $this->get_admin_header_menus(),
			'is_pro_active'          => defined( 'POWER_COUPONS_PRO_VERSION' ),
			'is_pro_installed'       => file_exists( WP_PLUGIN_DIR . '/power-coupons-pro/power-coupons-pro.php' ),
			'activate_pro_nonce'     => wp_create_nonce( 'power_coupons_activate_pro' ),
		);

		$localize_data = apply_filters( 'power_coupons_filter_admin_localize_data', $localize_data );

		// Inject PRO data into settings state so React components can access via useStateValue().
		if ( ! empty( $localize_data['pro_version'] ) ) {
			$localize_data['power_coupons_settings']['pro_version']    = $localize_data['pro_version'];
			$localize_data['power_coupons_settings']['license_status'] = $localize_data['license_status'] ?? '';
		}

		wp_localize_script( 'power-coupons-settings', 'powerCouponsSettings', $localize_data );
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
				'priority' => 10,
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
				'priority' => 40,
			),
		);

		return apply_filters( 'power_coupons_filter_settings_tabs', $tabs );
	}

	/**
	 * Get settings fields
	 *
	 * @since 1.0.0
	 * @return array
	 */
	private function get_settings_fields() {
		return array(
			'power_coupons_general'        => $this->get_general_fields(),
			'power_coupons_coupon_styling' => $this->get_coupon_styling_fields(),
			'power_coupons_text'           => $this->get_text_fields(),
		);
	}

	/**
	 * Get general tab fields
	 *
	 * @since 1.0.0
	 * @return array
	 */
	private function get_general_fields() {
		return array(
			// Core Settings.
			array(
				'name'          => 'general[enable_plugin]',
				'label'         => __( 'Enable Plugin', 'power-coupons' ),
				'description'   => __( 'Enable or disable Power Coupons functionality globally', 'power-coupons' ),
				'type'          => 'toggle',
				'section'       => 'core',
				'section_title' => __( 'Core Settings', 'power-coupons' ),
			),
			array(
				'name'        => 'general[show_on_cart]',
				'label'       => __( 'Show on Cart', 'power-coupons' ),
				'description' => __( 'Display available coupons on cart page', 'power-coupons' ),
				'type'        => 'toggle',
				'section'     => 'core',
			),
			array(
				'name'        => 'general[show_on_checkout]',
				'label'       => __( 'Show on Checkout', 'power-coupons' ),
				'description' => __( 'Display available coupons on checkout page', 'power-coupons' ),
				'type'        => 'toggle',
				'section'     => 'core',
			),
			// Display Locations.
			array(
				'name'        => 'general[enable_for_guests]',
				'label'       => __( 'Enable for Guests', 'power-coupons' ),
				'description' => __( 'Allow guest users to see and use coupons', 'power-coupons' ),
				'type'        => 'toggle',
				'section'     => 'core',
			),
			// Basic Behavior..
			array(
				'name'        => 'general[show_applied_coupons]',
				'label'       => __( 'Show Applied Coupons', 'power-coupons' ),
				'description' => __( 'Display list of currently applied coupons', 'power-coupons' ),
				'type'        => 'toggle',
				'section'     => 'behavior',
			),
			array(
				'name'        => 'general[show_expiry_info]',
				'label'       => __( 'Show Expiry Info', 'power-coupons' ),
				'description' => __( 'Show expiry date/countdown for coupons', 'power-coupons' ),
				'type'        => 'toggle',
				'section'     => 'behavior',
			),
		);
	}

	/**
	 * Get coupon styling fields configuration.
	 *
	 * @return array Array of styling field configurations.
	 */
	private function get_coupon_styling_fields() {
		return array(
			// Section Headings.
			array(
				'name'          => 'coupon_styling[coupon_style]',
				'label'         => __( 'Choose Coupon Styling', 'power-coupons' ),
				'description'   => __( 'Select a visual style template for how your coupons will be displayed to customers.', 'power-coupons' ),
				'type'          => 'coupon_template_picker',
				'section'       => 'headings',
				'section_title' => __( 'Section Headings', 'power-coupons' ),
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
			// Section Headings.
			array(
				'name'        => 'text[drawer_heading]',
				'label'       => __( 'Drawer Heading', 'power-coupons' ),
				'description' => __( 'Drawer heading text', 'power-coupons' ),
				'type'        => 'text',
			),
			array(
				'name'        => 'text[trigger_button_label]',
				'label'       => __( 'Drawer Trigger Button Label', 'power-coupons' ),
				'description' => __( 'Text label for the drawer trigger button', 'power-coupons' ),
				'type'        => 'text',
			),
			array(
				'name'        => 'text[coupon_applying_text]',
				'label'       => __( 'Coupon Applying Text', 'power-coupons' ),
				'description' => __( 'Text to display when coupon is applying.', 'power-coupons' ),
				'type'        => 'text',
			),
			array(
				'name'        => 'text[coupon_applied_text]',
				'label'       => __( 'Coupon Applied Text', 'power-coupons' ),
				'description' => __( 'Text to display when coupon is successfully applied.', 'power-coupons' ),
				'type'        => 'text',
			),
			array(
				'name'        => 'text[no_coupons_text]',
				'label'       => __( 'No Coupons Text', 'power-coupons' ),
				'description' => __( 'Text to display when no valid coupons are available.', 'power-coupons' ),
				'type'        => 'text',
			),
			array(
				'name'        => 'text[coupons_loading_text]',
				'label'       => __( 'Coupons Loading Text', 'power-coupons' ),
				'description' => __( 'Text to display when coupons are loading in the drawer.', 'power-coupons' ),
				'type'        => 'text',
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
		return array(
			'power_coupons_coupon_styling' => '<svg width="18" height="13" viewBox="0 0 18 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 1.25V1.875M12.5 4.375V5M12.5 7.5V8.125M12.5 10.625V11.25M5 6.875H9.375M5 8.75H7.5M1.5625 0.625C1.04473 0.625 0.625 1.04473 0.625 1.5625V4.08446C1.37225 4.51672 1.875 5.32465 1.875 6.25C1.875 7.17535 1.37225 7.98328 0.625 8.41554V10.9375C0.625 11.4553 1.04473 11.875 1.5625 11.875H15.9375C16.4553 11.875 16.875 11.4553 16.875 10.9375V8.41554C16.1277 7.98328 15.625 7.17535 15.625 6.25C15.625 5.32465 16.1277 4.51672 16.875 4.08446V1.5625C16.875 1.04473 16.4553 0.625 15.9375 0.625H1.5625Z" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>',
			'power_coupons_general'        => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>',
			'power_coupons_text'           => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>',
		);
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
			'general'        => $this->sanitize_general_settings( $settings['general'] ?? array() ),
			'coupon_styling' => $this->sanitize_coupon_styling_settings( $settings['coupon_styling'] ?? array() ),
			'text'           => $this->sanitize_text_settings( $settings['text'] ?? array() ),
		);

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
			'enable_plugin'        => ! empty( $settings['enable_plugin'] ),
			'show_on_cart'         => ! empty( $settings['show_on_cart'] ),
			'show_on_checkout'     => ! empty( $settings['show_on_checkout'] ),
			'enable_for_guests'    => ! empty( $settings['enable_for_guests'] ),
			'hide_wc_coupon_field' => ! empty( $settings['hide_wc_coupon_field'] ),
			'show_applied_coupons' => ! empty( $settings['show_applied_coupons'] ),
			'show_expiry_info'     => ! empty( $settings['show_expiry_info'] ),
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

}
