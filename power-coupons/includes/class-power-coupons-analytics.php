<?php
/**
 * Power Coupons Analytics — single entry point for all BSF Analytics tracking.
 *
 * Owns the complete Power Coupons stats payload (default stats, numeric_values,
 * boolean_values, kpi_records) and one-time milestone events via
 * BSF_Analytics_Events.
 *
 * @package Power_Coupons
 * @since   1.0.3
 */

namespace Power_Coupons\Includes;

use Power_Coupons\Includes\Traits\Power_Coupons_Singleton;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Power_Coupons_Analytics.
 */
class Power_Coupons_Analytics {

	use Power_Coupons_Singleton;

	/**
	 * Shared BSF_Analytics_Events instance.
	 *
	 * @var \BSF_Analytics_Events|null
	 */
	private static $events = null;

	/**
	 * Constructor.
	 *
	 * @since 1.0.3
	 */
	protected function __construct() {
		if ( ! is_admin() ) {
			return;
		}

		// Single bsf_core_stats filter — owns the complete Power Coupons payload.
		add_filter( 'bsf_core_stats', array( $this, 'get_stats' ) );

		// State-based events — throttled to once per day via transient.
		if ( false === get_transient( 'power_coupons_state_events_checked' ) ) {
			$this->detect_state_events();
		}
	}

	/**
	 * Get shared BSF_Analytics_Events instance.
	 *
	 * Returns null if BSF_Analytics_Events is not yet loaded — callers must guard.
	 *
	 * @since 1.0.3
	 * @return \BSF_Analytics_Events|null
	 */
	public static function events() {
		if ( null === self::$events ) {
			if ( ! class_exists( 'BSF_Analytics_Events' ) ) {
				return null;
			}
			self::$events = new \BSF_Analytics_Events( 'power-coupons' );
		}
		return self::$events;
	}

	// -------------------------------------------------------------------------
	// BSF Analytics stats payload
	// -------------------------------------------------------------------------

	/**
	 * Build and append the complete Power Coupons analytics payload.
	 *
	 * @since 1.0.3
	 * @param array<string, mixed> $stats_data Existing analytics payload.
	 * @return array<string, mixed>
	 */
	public function get_stats( $stats_data ) {
		$settings = Power_Coupons_Settings_Helper::get_instance();

		if ( ! $settings->get( 'general', 'enable_usage_tracking', false ) ) {
			return $stats_data;
		}

		$theme_data = $this->get_active_theme();

		if ( ! isset( $stats_data['plugin_data'] ) || ! is_array( $stats_data['plugin_data'] ) ) {
			$stats_data['plugin_data'] = array();
		}

		$stats_data['plugin_data']['power_coupons']                   = $this->get_default_stats( $theme_data );
		$stats_data['plugin_data']['power_coupons']['numeric_values'] = $this->get_numeric_data_stats();
		$stats_data['plugin_data']['power_coupons']['boolean_values'] = $this->get_boolean_data_stats( $settings );
		$stats_data['plugin_data']['power_coupons']['kpi_records']    = $this->get_kpi_tracking_data();

		// Append pending milestone events.
		$events = self::events();
		if ( null !== $events ) {
			$stats_data['plugin_data']['power_coupons']['events_record'] = $events->flush_pending();
		}

		return $stats_data;
	}

	/**
	 * Retrieve default statistics.
	 *
	 * @since 1.0.3
	 * @param array{parent_theme: string, child_theme: bool} $theme_data Active theme information.
	 * @return array<string, mixed>
	 */
	private function get_default_stats( $theme_data ) {
		$store_location = '';
		$woo_version    = '';

		if ( class_exists( 'WooCommerce' ) ) {
			$store_location = wc_get_base_location();
			$woo_version    = WC()->version;
		}

		return array(
			'website_domain'      => str_ireplace( array( 'http://', 'https://' ), '', home_url() ),
			'site_language'       => get_locale(),
			'plugin_version'      => POWER_COUPONS_VERSION,
			'pro_version'         => defined( 'POWER_COUPONS_PRO_VERSION' ) ? POWER_COUPONS_PRO_VERSION : '',
			'woocommerce_version' => $woo_version,
			'php_version'         => phpversion(),
			'active_theme'        => $theme_data['parent_theme'],
			'is_child_theme'      => $theme_data['child_theme'],
			'store_country'       => ! empty( $store_location['country'] ) ? $store_location['country'] : '',
		);
	}

	/**
	 * Retrieve numeric data statistics.
	 *
	 * @since 1.0.3
	 * @return array<string, int>
	 */
	private function get_numeric_data_stats() {
		$coupon_counts = wp_count_posts( 'shop_coupon' );
		$rule_counts   = wp_count_posts( 'power_coupon' );

		// Count non-default text customizations.
		$settings     = Power_Coupons_Settings_Helper::get_instance();
		$defaults     = Power_Coupons_Settings_Helper::get_default_settings();
		$text_customs = 0;
		/** @var array<string, mixed> $default_texts */ // phpcs:ignore Generic.Commenting.DocComment.MissingShort
		$default_texts = is_array( $defaults['text'] ?? null ) ? $defaults['text'] : array();

		foreach ( $default_texts as $key => $default_val ) {
			$current_val = $settings->get( 'text', (string) $key, $default_val );
			if ( $current_val !== $default_val ) {
				++$text_customs;
			}
		}

		return array(
			'total_coupons'             => isset( $coupon_counts->publish ) ? (int) $coupon_counts->publish : 0,
			'total_rules'               => isset( $rule_counts->publish ) ? (int) $rule_counts->publish : 0,
			'text_customizations_count' => $text_customs,
		);
	}

	/**
	 * Retrieve boolean data statistics.
	 *
	 * @since 1.0.3
	 * @param Power_Coupons_Settings_Helper $settings Settings helper instance.
	 * @return array<string, mixed>
	 */
	private function get_boolean_data_stats( $settings ) {
		return array(
			'enable_plugin'             => (bool) $settings->get( 'general', 'enable_plugin', true ),
			'show_on_cart'              => (bool) $settings->get( 'general', 'show_on_cart', true ),
			'show_on_checkout'          => (bool) $settings->get( 'general', 'show_on_checkout', true ),
			'enable_for_guests'         => (bool) $settings->get( 'general', 'enable_for_guests', true ),
			'hide_wc_coupon_field'      => (bool) $settings->get( 'general', 'hide_wc_coupon_field', false ),
			'show_applied_coupons'      => (bool) $settings->get( 'general', 'show_applied_coupons', true ),
			'show_expiry_info'          => (bool) $settings->get( 'general', 'show_expiry_info', true ),
			'cart_progress_bar_enabled' => (bool) $settings->get( 'cart_progress_bar', 'enable', false ),
			'coupon_display_mode'       => $settings->get( 'general', 'coupon_display_mode', 'drawer' ),
			'coupon_style'              => $settings->get( 'coupon_styling', 'coupon_style', 'style-1' ),
			'pro_active'                => defined( 'POWER_COUPONS_PRO_VERSION' ),
			'enable_usage_tracking'     => (bool) $settings->get( 'general', 'enable_usage_tracking', false ),
		);
	}

	/**
	 * Get KPI tracking data for the last 2 days (excluding today).
	 *
	 * @since 1.0.3
	 * @return array<string, array<string, array<string, int>>> KPI records keyed by date.
	 */
	private function get_kpi_tracking_data() {
		$kpi_data = array();

		for ( $i = 1; $i <= 2; $i++ ) {
			$date = wp_date( 'Y-m-d', strtotime( "-{$i} days" ) );
			if ( false === $date ) {
				continue;
			}
			$kpi_data[ $date ] = array(
				'numeric_values' => array(
					'coupons_applied' => $this->get_daily_coupons_applied_count( $date ),
				),
			);
		}

		return $kpi_data;
	}

	/**
	 * Get daily coupon application count for a specific date.
	 *
	 * Counts completed/processing orders that used coupons.
	 * Supports both classic post-table and HPOS order storage.
	 *
	 * @since 1.0.3
	 * @param string $date Date in Y-m-d format.
	 * @return int
	 */
	private function get_daily_coupons_applied_count( $date ) {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return 0;
		}

		$args = array(
			'status'       => array( 'wc-completed', 'wc-processing' ),
			'date_created' => $date . '...' . $date,
			'limit'        => -1,
			'return'       => 'ids',
		);

		/** @var array<int, int> $orders */ // phpcs:ignore Generic.Commenting.DocComment.MissingShort
		$orders = wc_get_orders( $args );
		$count  = 0;

		foreach ( $orders as $order_id ) {
			$order = wc_get_order( $order_id );
			if ( $order && count( $order->get_coupon_codes() ) > 0 ) {
				++$count;
			}
		}

		return $count;
	}

	// -------------------------------------------------------------------------
	// Helper methods
	// -------------------------------------------------------------------------

	/**
	 * Retrieve the active theme name.
	 *
	 * @since 1.0.3
	 * @return array{parent_theme: string, child_theme: bool}
	 */
	private function get_active_theme() {
		$theme             = wp_get_theme();
		$parent_theme_name = '';
		$child_theme_name  = '';

		if ( ! empty( $theme->parent_theme ) ) {
			$parent_theme_name = $theme->parent_theme;
			$child_theme_name  = $theme->name ? $theme->name : '';
		} else {
			$parent_theme_name = $theme->name;
		}

		return array(
			'parent_theme' => ! empty( $child_theme_name ) ? $child_theme_name : $parent_theme_name,
			'child_theme'  => ! empty( $child_theme_name ),
		);
	}

	// -------------------------------------------------------------------------
	// Milestone event tracking
	// -------------------------------------------------------------------------

	/**
	 * Detect and queue state-based one-time events.
	 *
	 * Called once per day (throttled by transient). BSF_Analytics_Events dedup
	 * prevents duplicate tracking across days.
	 *
	 * @since 1.0.3
	 * @return void
	 */
	private function detect_state_events() {
		$events = self::events();
		if ( null === $events ) {
			return;
		}

		// Class is available — throttle for 24 hours.
		set_transient( 'power_coupons_state_events_checked', 1, DAY_IN_SECONDS );

		$settings = Power_Coupons_Settings_Helper::get_instance();

		// ---- Activation & Setup ----

		// plugin_activated — fires once on first admin load after activation.
		$events->track( 'plugin_activated', POWER_COUPONS_VERSION );

		// plugin_updated — fires when version changes.
		$stored_version = get_option( 'power_coupons_tracked_version', '' );
		if ( POWER_COUPONS_VERSION !== $stored_version ) {
			if ( ! empty( $stored_version ) ) {
				$events->flush_pushed( array( 'plugin_updated' ) );
				$events->track(
					'plugin_updated',
					POWER_COUPONS_VERSION,
					array( 'from_version' => $stored_version )
				);
			}
			update_option( 'power_coupons_tracked_version', POWER_COUPONS_VERSION );
		}

		// onboarding_completed (only if the user finished all steps, not if they skipped).
		$skipped_data = get_option( 'power_coupons_onboarding_skipped', false );
		if ( 'yes' === get_option( 'power_coupons_is_onboarding_complete', 'no' ) && empty( $skipped_data ) ) {
			$events->track( 'onboarding_completed' );
		}

		// onboarding_skipped.
		if ( ! empty( $skipped_data ) ) {
			$exit_step = is_array( $skipped_data ) ? ( $skipped_data['exit_step'] ?? '' ) : '';
			$events->track(
				'onboarding_skipped',
				'',
				array( 'exit_step' => sanitize_text_field( (string) $exit_step ) )
			);
		}

		// pro_license_activated.
		if ( defined( 'POWER_COUPONS_PRO_VERSION' ) ) {
			$events->track( 'pro_license_activated' );
		}

		// ---- Feature Usage Events ----

		// first_coupon_displayed.
		$first_displayed = get_option( 'power_coupons_first_coupon_displayed' );
		if ( ! empty( $first_displayed ) && is_array( $first_displayed ) ) {
			$raw_time     = get_option( 'power_coupons_usage_installed_time', 0 );
			$install_time = is_numeric( $raw_time ) ? (int) $raw_time : 0;
			$days         = 0;
			if ( $install_time > 0 ) {
				$days = (int) floor( ( time() - $install_time ) / DAY_IN_SECONDS );
			}
			$events->track(
				'first_coupon_displayed',
				'',
				array(
					'days_since_install' => (string) $days,
					'context'            => sanitize_text_field( (string) ( $first_displayed['context'] ?? '' ) ),
				)
			);
		}

		// first_coupon_applied.
		if ( get_option( 'power_coupons_first_coupon_applied' ) ) {
			$events->track( 'first_coupon_applied' );
		}

		// first_rule_created.
		if ( get_option( 'power_coupons_first_rule_created' ) ) {
			$events->track( 'first_rule_created' );
		}

		// first_bogo_created (PRO).
		if ( get_option( 'power_coupons_pro_first_bogo_created' ) ) {
			$events->track( 'first_bogo_created' );
		}

		// ---- PRO: License ----

		// first_license_activated (PRO flag-setter).
		if ( get_option( 'power_coupons_pro_first_license_activated' ) ) {
			$events->track( 'first_license_activated' );
		}

		// ---- PRO: Points & Rewards Events ----

		// first_points_campaign_created (PRO flag-setter).
		if ( get_option( 'power_coupons_pro_first_points_campaign_created' ) ) {
			$events->track( 'first_points_campaign_created' );
		}

		// first_points_earned (PRO flag-setter).
		if ( get_option( 'power_coupons_pro_first_points_earned' ) ) {
			$events->track( 'first_points_earned' );
		}

		// first_points_redeemed (PRO flag-setter).
		if ( get_option( 'power_coupons_pro_first_points_redeemed' ) ) {
			$events->track( 'first_points_redeemed' );
		}

		// first_points_credit_applied (PRO flag-setter).
		if ( get_option( 'power_coupons_pro_first_points_credit_applied' ) ) {
			$events->track( 'first_points_credit_applied' );
		}

		// first_progress_bar_enabled.
		if ( $settings->get( 'cart_progress_bar', 'enable', false ) ) {
			$events->track( 'first_progress_bar_enabled' );
		}

		// first_style_changed.
		$coupon_style = $settings->get( 'coupon_styling', 'coupon_style', 'style-1' );
		if ( is_string( $coupon_style ) && 'style-1' !== $coupon_style ) {
			$events->track(
				'first_style_changed',
				'',
				array( 'style' => sanitize_text_field( $coupon_style ) )
			);
		}

		// first_text_customized.
		$defaults = Power_Coupons_Settings_Helper::get_default_settings();
		/** @var array<string, mixed> $default_texts */ // phpcs:ignore Generic.Commenting.DocComment.MissingShort
		$default_texts = is_array( $defaults['text'] ?? null ) ? $defaults['text'] : array();
		foreach ( $default_texts as $key => $default_val ) {
			if ( $settings->get( 'text', (string) $key, $default_val ) !== $default_val ) {
				$events->track( 'first_text_customized' );
				break;
			}
		}

		// ---- Configuration Events ----

		if ( $settings->get( 'general', 'show_on_cart', true ) ) {
			$events->track( 'cart_display_enabled' );
		}

		if ( $settings->get( 'general', 'show_on_checkout', true ) ) {
			$events->track( 'checkout_display_enabled' );
		}

		if ( $settings->get( 'general', 'enable_for_guests', true ) ) {
			$events->track( 'guest_access_enabled' );
		}

		if ( $settings->get( 'general', 'hide_wc_coupon_field', false ) ) {
			$events->track( 'wc_coupon_field_hidden' );
		}

		// ---- Engagement Events ----

		$display_mode = $settings->get( 'general', 'coupon_display_mode', 'drawer' );
		if ( 'drawer' === $display_mode ) {
			$events->track( 'drawer_mode_selected' );
		} elseif ( 'modal' === $display_mode ) {
			$events->track( 'modal_mode_selected' );
		}

		if ( $settings->get( 'general', 'show_expiry_info', true ) ) {
			$events->track( 'expiry_info_enabled' );
		}

		// Check for non-default progress bar colors.
		$bar_defaults = is_array( $defaults['cart_progress_bar'] ?? null ) ? $defaults['cart_progress_bar'] : array();
		$bar_color    = $settings->get( 'cart_progress_bar', 'bar_color', '#f97316' );
		$bar_bg       = $settings->get( 'cart_progress_bar', 'bar_bg_color', '#e5e7eb' );
		$success      = $settings->get( 'cart_progress_bar', 'success_color', '#16a34a' );
		if ( ( $bar_defaults['bar_color'] ?? '#f97316' ) !== $bar_color
			|| ( $bar_defaults['bar_bg_color'] ?? '#e5e7eb' ) !== $bar_bg
			|| ( $bar_defaults['success_color'] ?? '#16a34a' ) !== $success
		) {
			$events->track( 'progress_bar_colors_customized' );
		}
	}
}
