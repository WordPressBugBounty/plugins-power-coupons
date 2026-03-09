<?php
/**
 * Coupon Meta Box
 *
 * @package Power_Coupons
 * @since 1.0.0
 */

namespace Power_Coupons\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Admin_Coupon_Meta
 */
class Admin_Coupon_Meta {

	/**
	 * Instance
	 *
	 * @var object
	 */
	private static $instance = null;

	/**
	 * Get Instance
	 *
	 * @return object
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor
	 */
	public function __construct() {
		add_action( 'woocommerce_coupon_options', array( $this, 'add_auto_apply_field' ), 10 );
		add_action( 'woocommerce_coupon_options_save', array( $this, 'save_auto_apply_field' ), 10, 2 );

		add_filter( 'woocommerce_coupon_data_tabs', array( $this, 'add_coupon_meta_tab' ) );
	}

	/**
	 * Add auto apply field
	 *
	 * @param int $coupon_id Coupon ID.
	 */
	public function add_auto_apply_field( $coupon_id ) {
		// Add nonce field for security.
		wp_nonce_field( 'power_coupons_save_coupon_meta', 'power_coupons_coupon_meta_nonce' );

		echo '<hr id="_power_coupon_divider">';

		woocommerce_wp_text_input(
			array(
				'id'                => '_power_coupon_start_date',
				'label'             => __( 'Coupon start date', 'power-coupons' ),
				'placeholder'       => 'YYYY-MM-DD',
				'description'       => __( 'The date this coupon becomes active.', 'power-coupons' ),
				'desc_tip'          => true,
				'class'             => 'date-picker',
				'custom_attributes' => array(
					'pattern' => '[0-9]{4}-(0[1-9]|1[012])-(0[1-9]|1[0-9]|2[0-9]|3[01])',
				),
				'value'             => get_post_meta( $coupon_id, '_power_coupon_start_date', true ),
			)
		);

		woocommerce_wp_checkbox(
			array(
				'id'          => '_power_coupon_auto_apply',
				'label'       => __( 'Auto Apply', 'power-coupons' ),
				'description' => __( 'Automatically apply this coupon when conditions are met.', 'power-coupons' ),
				'value'       => get_post_meta( $coupon_id, '_power_coupon_auto_apply', true ),
			)
		);
	}

	/**
	 * Save auto apply field
	 *
	 * @param int    $coupon_id Coupon ID.
	 * @param object $coupon Coupon object.
	 */
	public function save_auto_apply_field( $coupon_id, $coupon ) {
		// Verify nonce for security.
		if ( ! isset( $_POST['power_coupons_coupon_meta_nonce'] ) ||
			! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['power_coupons_coupon_meta_nonce'] ) ), 'power_coupons_save_coupon_meta' ) ) {
			return;
		}

		// Check user capabilities.
		if ( ! current_user_can( 'edit_shop_coupons' ) ) {
			return;
		}

		$auto_apply = isset( $_POST['_power_coupon_auto_apply'] ) ? 'yes' : 'no';
		update_post_meta( $coupon_id, '_power_coupon_auto_apply', $auto_apply );

		if ( isset( $_POST['_power_coupon_start_date'] ) ) {
			$start_date = sanitize_text_field( wp_unslash( $_POST['_power_coupon_start_date'] ) );
			update_post_meta( $coupon_id, '_power_coupon_start_date', $start_date );
		}
	}

	/**
	 * Add custom coupon meta tab
	 *
	 * @param array $tabs Existing tabs.
	 * @return array Modified tabs.
	 */
	public function add_coupon_meta_tab( $tabs ) {
		$tabs['power_coupons_rules'] = array(
			'label'  => __( 'Rules', 'power-coupons' ),
			'target' => 'power_coupons_rules_tab',
			'class'  => 'power_coupons_rules_tab',
		);

		return $tabs;
	}
}
