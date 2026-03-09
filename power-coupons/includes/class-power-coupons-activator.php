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

		// Create custom post type for power coupons.
		self::create_post_type();

		// Flush rewrite rules.
		flush_rewrite_rules();

		// Set activation flag.
		set_transient( 'power_coupons_activated', true, 30 );
	}

	/**
	 * Deactivate plugin
	 *
	 * @since 1.0.0
	 * @return void
	 */
	public static function deactivate() {
		// Flush rewrite rules.
		flush_rewrite_rules();

		// Clear any transients.
		delete_transient( 'power_coupons_activated' );
	}

	/**
	 * Create custom post type for power coupons
	 *
	 * @since 1.0.0
	 * @return void
	 */
	private static function create_post_type() {
		$args = array(
			'public'             => false,
			'publicly_queryable' => false,
			'show_ui'            => true,
			'show_in_menu'       => false,
			'query_var'          => true,
			'rewrite'            => false,
			'capability_type'    => 'post',
			'has_archive'        => false,
			'hierarchical'       => false,
			'supports'           => array( 'title' ),
		);

		register_post_type( 'power_coupon', $args );
	}
}

