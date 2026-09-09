<?php
/**
 * Plugin Loader.
 *
 * @package Power_Coupons
 * @since 1.0.0
 */

namespace Power_Coupons;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Power_Coupons_Loader
 *
 * @since 1.0.0
 */
class Power_Coupons_Loader {

	/**
	 * Instance
	 *
	 * @access private
	 * @var object Class Instance.
	 * @since 1.0.0
	 */
	private static $instance;

	/**
	 * Initiator
	 *
	 * @since 1.0.0
	 * @return object initialized object of class.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor
	 *
	 * @since 1.0.0
	 */
	public function __construct() {
		/*
		 * There is no autoloader here on purpose.
		 *
		 * One used to be registered, but it derived a filename by lowercasing the
		 * class and swapping separators — `…\Includes\Power_Coupons_Core` became
		 * `includes/power-coupons-core.php` — while every file in this plugin is
		 * named with the WordPress `class-` (or `trait-`) prefix. It therefore
		 * never resolved a single class, and `load_dependencies()` below has
		 * always been the real loader.
		 *
		 * Adding a new class means adding a `require_once` to
		 * `load_dependencies()`. Nothing loads implicitly.
		 */

		// Declare WooCommerce compatibility.
		add_action( 'before_woocommerce_init', array( $this, 'declare_woocommerce_compatibility' ) );

		add_action( 'plugins_loaded', array( $this, 'init_plugin' ), 20 );
	}

	/**
	 * Declare WooCommerce compatibility
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function declare_woocommerce_compatibility() {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			// Declare compatibility with custom order tables (HPOS).
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', POWER_COUPONS_FILE, true );
			// Declare compatibility with cart/checkout blocks.
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', POWER_COUPONS_FILE, true );
		}
	}

	/**
	 * Check if WooCommerce is active
	 *
	 * @since 1.0.0
	 * @return bool
	 */
	private function is_woocommerce_active() {
		return class_exists( 'WooCommerce' ) || function_exists( 'WC' );
	}

	/**
	 * Initialize plugin
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public function init_plugin() {
		// Check WooCommerce is active before initializing.
		if ( ! $this->is_woocommerce_active() ) {
			return;
		}

		// Load dependencies first.
		$this->load_dependencies();

		// Register the migration entry points (admin, WP-CLI and cron).
		\Power_Coupons\Includes\Power_Coupons_Migration::register();

		// Initialize main plugin class.
		\Power_Coupons\Includes\Power_Coupons_Core::get_instance();
	}

	/**
	 * Load plugin dependencies
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private function load_dependencies() {
		// Load traits first.
		require_once POWER_COUPONS_DIR . 'includes/traits/trait-power-coupons-singleton.php';

		// Load activator class.
		require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-activator.php';

		// Load main plugin class.
		require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-core.php';

		// Load utility classes.
		require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-utilities.php';
		require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-settings-helper.php';
		require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-migration.php';

		// Load analytics tracking.
		require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-analytics.php';

		// Load controllers.
		require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-wc-blocks-integration.php';

		// Load rules registry (conditional rules metadata schema).
		require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-rules-registry.php';

		// Load models.
		require_once POWER_COUPONS_DIR . 'models/class-power-coupons-rule-model.php';
		require_once POWER_COUPONS_DIR . 'models/class-power-coupons-cart-model.php';

		// Load controllers.
		require_once POWER_COUPONS_DIR . 'controllers/class-power-coupons-rule-controller.php';
		require_once POWER_COUPONS_DIR . 'controllers/class-power-coupons-auto-apply-controller.php';
		require_once POWER_COUPONS_DIR . 'controllers/class-power-coupons-cart-controller.php';
		require_once POWER_COUPONS_DIR . 'controllers/class-power-coupons-display-controller.php';
		require_once POWER_COUPONS_DIR . 'controllers/class-checkout-drawer-controller.php';
		require_once POWER_COUPONS_DIR . 'controllers/class-power-coupons-coupon-usage-controller.php';

		// Load admin and public classes.
		if ( is_admin() ) {
			require_once POWER_COUPONS_DIR . 'admin/class-power-coupons-admin.php';
			require_once POWER_COUPONS_DIR . 'admin/class-power-coupons-admin-rules.php';
			require_once POWER_COUPONS_DIR . 'admin/class-power-coupons-bsf-analytics.php';
		}

		require_once POWER_COUPONS_DIR . 'public/class-power-coupons-frontend.php';
		require_once POWER_COUPONS_DIR . 'public/class-power-coupons-frontend-rules.php';

		// Load Abilities API (WordPress 6.9+).
		$this->load_abilities_api();
	}

	/**
	 * Load WordPress Abilities API integration.
	 *
	 * Gracefully degrades: if WordPress < 6.9 or class WP_Ability
	 * does not exist, the plugin functions normally without abilities.
	 *
	 * @since 1.1.0
	 * @return void
	 */
	private function load_abilities_api() {
		if ( ! class_exists( 'WP_Ability' ) ) {
			return;
		}

		if ( ! defined( 'POWER_COUPONS_ABILITY_API' ) ) {
			define( 'POWER_COUPONS_ABILITY_API', true );
		}

		if ( ! defined( 'POWER_COUPONS_ABILITY_API_NAMESPACE' ) ) {
			define( 'POWER_COUPONS_ABILITY_API_NAMESPACE', 'power-coupons/' );
		}

		require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-config-ability.php';
		require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-ability.php';

		$pc_ability = new \Power_Coupons\Includes\Power_Coupons_Ability();
		add_action( 'wp_abilities_api_categories_init', array( $pc_ability, 'register_categories' ) );
		add_action( 'wp_abilities_api_init', array( $pc_ability, 'register' ) );
	}
}
