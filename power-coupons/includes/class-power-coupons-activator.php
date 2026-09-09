<?php
/**
 * Fired during plugin activation
 *
 * @package Power_Coupons
 * @since 1.0.0
 */

namespace Power_Coupons\Includes;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Class Power_Coupons_Activator
 */
class Power_Coupons_Activator {

	/**
	 * Activate plugin
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function activate() {
		/*
		 * No post type is registered here.
		 *
		 * A `power_coupon` post type used to be registered from this activation
		 * hook and nowhere else, so it never existed at runtime — nothing could
		 * read or write it, and the telemetry metric that counted it reported 0
		 * for every store. Conditional rules live in `shop_coupon` meta; see
		 * Power_Coupons_Rules_Registry.
		 */

		// Run data migrations (idempotent — safe to run on every activation).
		require_once POWER_COUPONS_DIR . 'includes/class-power-coupons-migration.php';
		Power_Coupons_Migration::run_on_activation();

		// Set activation flag.
		set_transient( 'power_coupons_activated', true, 30 );

		// Set onboarding redirect transient, unless onboarding is already finished or
		// the merchant has exited it. Exiting pauses the wizard rather than finishing
		// it, so the completion flag stays 'no' and cannot be what suppresses the
		// redirect — without a flag of its own, every reactivation would drag someone
		// who had already walked away straight back into the wizard.
		$is_onboarding_complete  = get_option( 'power_coupons_is_onboarding_complete', 'no' );
		$is_onboarding_dismissed = get_option( 'power_coupons_onboarding_dismissed', 'no' );
		if ( 'yes' !== $is_onboarding_complete && 'yes' !== $is_onboarding_dismissed ) {
			set_transient( 'power_coupons_redirect_to_onboarding', 'yes' );
		}

		// Record install time for analytics (days_since_install calculation).
		if ( ! get_option( 'power_coupons_usage_installed_time' ) ) {
			update_option( 'power_coupons_usage_installed_time', time() );
		}
	}

	/**
	 * Deactivate plugin
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function deactivate() {
		/*
		 * No rewrite flush: this plugin registers no post types, taxonomies or
		 * endpoints, so there are no rules to rebuild. The `power_coupon` post
		 * type that used to be registered in activate() never existed at
		 * runtime, and is gone.
		 */

		// Clear any transients.
		delete_transient( 'power_coupons_activated' );
	}

}

