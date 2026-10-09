<?php
/**
 * Coupon Display Controller
 *
 * @package Power_Coupons
 * @since 1.0.0
 */

namespace Power_Coupons\Controllers;

use Power_Coupons\Includes\Power_Coupons_Settings_Helper;
use Power_Coupons\Includes\Power_Coupons_Utilities;
use Power_Coupons\Includes\Traits\Power_Coupons_Singleton;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Display_Controller
 */
class Display_Controller {

	use Power_Coupons_Singleton;

	/**
	 * Flag to prevent multiple displays
	 *
	 * @var bool
	 */
	private $displayed = false;

	/**
	 * Settings Helper instance
	 *
	 * @var Power_Coupons_Settings_Helper
	 */
	private $settings_helper;

	/**
	 * Constructor
	 */
	protected function __construct() {
		$this->settings_helper = Power_Coupons_Settings_Helper::get_instance();
		$this->init_hooks();
	}

	/**
	 * Initialize hooks based on settings
	 *
	 * @return void
	 */
	private function init_hooks() {
		// Only initialize if plugin is enabled.
		if ( ! $this->settings_helper->is_enabled() ) {
			return;
		}

		// Add shortcode for manual placement.
		add_shortcode( 'power_coupons', array( $this, 'shortcode_display_coupons' ) );

		// Hide WooCommerce coupon field if enabled.
		if ( $this->settings_helper->get( 'general', 'hide_wc_coupon_field', false ) ) {
			add_filter( 'woocommerce_coupons_enabled', '__return_false' );
		}
	}

	/**
	 * Register cart display hook based on position
	 * Used dynamically by init_hooks method
	 *
	 * @phpstan-ignore-next-line
	 * @param string $position Cart display position.
	 * @return void
	 * @phpstan-ignore method.unused
	 */
	private function register_cart_hook( $position ) {
		$hook_map = array(
			'before_cart'       => 'woocommerce_before_cart',
			'before_cart_table' => 'woocommerce_before_cart_table',
			'after_cart_table'  => 'woocommerce_after_cart_table',
			'before_totals'     => 'woocommerce_before_cart_totals',
			'after_totals'      => 'woocommerce_after_cart_totals',
			'after_cart'        => 'woocommerce_after_cart',
		);

		$hook = $hook_map[ $position ] ?? 'woocommerce_before_cart_table';
		add_action( $hook, array( $this, 'display_coupons_on_cart' ), 10 );
	}

	/**
	 * Register checkout display hook based on position
	 * Used dynamically by init_hooks method
	 *
	 * @phpstan-ignore-next-line
	 * @param string $position Checkout display position.
	 * @return void
	 * @phpstan-ignore method.unused
	 */
	private function register_checkout_hook( $position ) {
		$hook_map = array(
			'before_checkout_form'     => 'woocommerce_before_checkout_form',
			'after_checkout_form'      => 'woocommerce_after_checkout_form',
			'before_checkout_billing'  => 'woocommerce_before_checkout_billing_form',
			'after_checkout_billing'   => 'woocommerce_after_checkout_billing_form',
			'before_checkout_shipping' => 'woocommerce_before_checkout_shipping_form',
			'after_checkout_shipping'  => 'woocommerce_after_checkout_shipping_form',
			'before_order_review'      => 'woocommerce_checkout_before_order_review',
			'after_order_review'       => 'woocommerce_checkout_after_order_review',
		);

		$hook = $hook_map[ $position ] ?? 'woocommerce_before_checkout_form';
		add_action( $hook, array( $this, 'display_coupons_on_checkout' ), 5 );
	}

	/**
	 * Shortcode to display coupons
	 *
	 * @param array<string, mixed> $attrs Shortcode attributes.
	 * @return string
	 */
	public function shortcode_display_coupons( $attrs ) {
		$raw_id    = isset( $attrs['id'] ) ? $attrs['id'] : 0;
		$coupon_id = is_numeric( $raw_id ) ? absint( $raw_id ) : 0;

		ob_start();
		$this->render_coupon_list( 'shortcode', $coupon_id );
		$output = ob_get_clean();
		return false !== $output ? $output : '';
	}

	/**
	 * Display coupons on cart page
	 *
	 * @param bool $force Force display even if already displayed.
	 * @return void
	 */
	public function display_coupons_on_cart( $force = false ) {
		// For WooCommerce Blocks, we want to always render, so check force flag.
		if ( ! $force && $this->displayed ) {
			return;
		}

		if ( ! $force ) {
			$this->displayed = true;
		}

		$this->render_coupon_list( 'cart' );
	}

	/**
	 * Display coupons on checkout page.
	 *
	 * @return void
	 */
	public function display_coupons_on_checkout() {
		$this->render_coupon_list( 'checkout' );
	}

	/**
	 * Display coupons on my account page
	 *
	 * @return void
	 */
	public function display_coupons_on_my_account() {
		$this->render_coupon_list( 'my-account' );
	}

	/**
	 * Render coupon list
	 *
	 * @param string $context Context (cart, checkout, my-account).
	 * @param int    $coupon_id Coupon ID (optional).
	 * @return void
	 */
	public function render_coupon_list( $context, $coupon_id = 0 ) {
		// Check if plugin is enabled.
		if ( ! $this->settings_helper->is_enabled() ) {
			return;
		}

		// Check if guest users can see coupons.
		if ( ! is_user_logged_in() && ! $this->settings_helper->enable_for_guests() ) {
			return;
		}

		// Check context-specific display settings.
		if ( 'cart' === $context && ! $this->settings_helper->should_show_on_cart() ) {
			return;
		}

		if ( 'checkout' === $context && ! $this->settings_helper->should_show_on_checkout() ) {
			return;
		}

		$coupons = Power_Coupons_Utilities::get_available_coupons( $coupon_id, 'coupon_list' );

		if ( empty( $coupons ) ) {
			return;
		}

		// Analytics flag-setter: first coupon displayed.
		if ( ! get_option( 'power_coupons_first_coupon_displayed' ) ) {
			update_option( 'power_coupons_first_coupon_displayed', array( 'context' => $context ) );
		}

		$all_coupons = array();

		foreach ( $coupons as $coupon ) {
			if ( ! is_array( $coupon ) ) {
				continue;
			}
			if ( Power_Coupons_Utilities::is_coupon_not_started( $coupon ) || Power_Coupons_Utilities::is_coupon_expired( $coupon ) ) {
				continue; // Skip coupons that haven't started yet.
			}

			$all_coupons[] = $coupon;
		}

		// Get settings for template.
		$text_settings           = $this->settings_helper->get_text_settings();
		$general_settings        = $this->settings_helper->get_general_settings();
		$coupon_styling_settings = $this->settings_helper->get_coupon_styling_settings();

		include \POWER_COUPONS_DIR . 'views/coupon-list.php';
	}
}
