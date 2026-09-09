<?php
/**
 * Main Plugin Class
 *
 * @package Power_Coupons
 * @since 1.0.0
 */

namespace Power_Coupons\Includes;

use Power_Coupons\Includes\Traits\Power_Coupons_Singleton;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Class Power_Coupons_Core
 */
class Power_Coupons_Core {

	use Power_Coupons_Singleton;

	/**
	 * Constructor
	 *
	 * @since 1.0.0
	 */
	protected function __construct() {
		$this->init();
	}

	/**
	 * Initialize plugin
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private function init() {
		// Initialize settings helper.
		Power_Coupons_Settings_Helper::get_instance();

		// Initialize WooCommerce Blocks integration.
		Power_Coupons_WC_Blocks_Integration::get_instance();

		// Initialize admin.
		if ( is_admin() && class_exists( '\Power_Coupons\Admin\Power_Coupons_Admin' ) ) {
			\Power_Coupons\Admin\Power_Coupons_Admin::get_instance();
		}

		// Initialize BSF Analytics (stats payload + deactivation survey).
		if ( is_admin() ) {
			\Power_Coupons\Admin\Power_Coupons_Bsf_Analytics::get_instance();
		}

		// Load the shared NPS Survey library (self-instantiates on include).
		// Must load on ALL requests, not just admin: the survey form submits via a
		// REST route where is_admin() is false, and this wrapper registers the
		// `nps_survey_api_endpoint` filter that points submissions at the Power
		// Coupons webhook. Gating it behind is_admin() drops the filter on submit,
		// so data would silently go to the default metrics endpoint instead.
		if ( ! class_exists( 'Power_Coupons_Nps_Survey' ) ) {
			require_once POWER_COUPONS_DIR . 'lib/class-power-coupons-nps-survey.php';
		}

		// Initialize analytics events tracking.
		Power_Coupons_Analytics::get_instance();

		// Track first real redemption of a Power Coupons coupon (value-based prompts).
		\Power_Coupons\Controllers\Coupon_Usage_Controller::get_instance();

		// Initialize public.
		\Power_Coupons\Public_Folder\Power_Coupons_Frontend::get_instance();
	}
}
