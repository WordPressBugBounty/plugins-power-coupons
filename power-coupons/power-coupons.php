<?php
/**
 * Plugin Name: Power Coupons for WooCommerce
 * Plugin URI: https://brainstormforce.com/
 * Description: Power Coupons is an advanced cart discount plugin for WooCommerce that helps you create discount rules, auto-apply coupons, and engaging cart incentives to boost conversions.
 * Version: 1.0.7
 * Author: Brainstorm Force
 * Author URI: https://www.brainstormforce.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: power-coupons
 * Domain Path: /languages
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * WC requires at least: 3.0
 * WC tested up to: 8.0
 *
 * Requires Plugins: woocommerce
 *
 * @package Power_Coupons
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Set constants
 */
define( 'POWER_COUPONS_VERSION', '1.0.7' );
define( 'POWER_COUPONS_FILE', __FILE__ );
define( 'POWER_COUPONS_BASE', plugin_basename( POWER_COUPONS_FILE ) );
define( 'POWER_COUPONS_DIR', plugin_dir_path( POWER_COUPONS_FILE ) );
define( 'POWER_COUPONS_URL', plugins_url( '/', POWER_COUPONS_FILE ) );
define( 'POWER_COUPONS_PLUGIN_FILE', POWER_COUPONS_FILE );

if ( ! defined( 'POWER_COUPONS_ONBOARDING_USER_SUB_WORKFLOW_URL' ) ) {
	define( 'POWER_COUPONS_ONBOARDING_USER_SUB_WORKFLOW_URL', 'https://webhook.ottokit.com/ottokit/ae829303-5da9-4daf-85f5-bbda71586f8c' );
}

if ( ! defined( 'POWER_COUPONS_NPS_WEBHOOK_URL' ) ) {
	define( 'POWER_COUPONS_NPS_WEBHOOK_URL', 'https://webhook.ottokit.com/ottokit/04399f32-0e78-40b1-8a93-6452ea18168c' );
}

/**
 * Load the top level files.
 */
require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-activator.php';
require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-loader.php';

/**
 * Register activation and deactivation hooks
 */
register_activation_hook( POWER_COUPONS_FILE, array( 'Power_Coupons\Includes\Power_Coupons_Activator', 'activate' ) );
register_deactivation_hook( POWER_COUPONS_FILE, array( 'Power_Coupons\Includes\Power_Coupons_Activator', 'deactivate' ) );

/**
 * Begins execution of the plugin.
 *
 * @since 1.0.0
 * @return object initialized object of class.
 */
function power_coupons() {
	return Power_Coupons\Power_Coupons_Loader::get_instance();
}

// Kicking this off by calling 'get_instance()' method.
power_coupons();

// The post-activation redirect lives in Power_Coupons_Admin_Settings::maybe_redirect_to_onboarding().
// It used to be duplicated here as well, and because this file is parsed before the class
// registers its own hook, this copy always ran first on admin_init and consumed the transient —
// so the capability, bulk-activation and already-completed checks over there never ran at all.

