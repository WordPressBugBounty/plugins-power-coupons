<?php
/**
 * Checkout Drawer Controller
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
 * Class Checkout_Drawer_Controller
 */
class Checkout_Drawer_Controller {

	use Power_Coupons_Singleton;

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
	 * Initialize hooks
	 *
	 * @return void
	 */
	private function init_hooks() {
		// Only initialize if plugin is enabled.
		if ( ! $this->settings_helper->is_enabled() ) {
			return;
		}

		// Check if guest users can see coupons.
		if ( ! is_user_logged_in() && ! $this->settings_helper->enable_for_guests() ) {
			return;
		}

		// Add button before payment section on checkout (after order review/coupon).
		if ( $this->settings_helper->should_show_on_cart() ) {
			add_action( 'woocommerce_proceed_to_checkout', array( $this, 'render_drawer_button' ), 10 );
		}

		if ( $this->settings_helper->should_show_on_checkout() ) {
			add_action( 'woocommerce_review_order_before_payment', array( $this, 'render_drawer_button' ), 10 );
		}

		// Add drawer HTML to footer.
		add_action( 'wp_footer', array( $this, 'render_drawer_html' ) );

		// Enqueue drawer assets.
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_drawer_assets' ) );

		// AJAX endpoint to get coupons for drawer.
		add_action( 'wp_ajax_power_coupons_get_drawer_coupons', array( $this, 'ajax_get_drawer_coupons' ) );
		add_action( 'wp_ajax_nopriv_power_coupons_get_drawer_coupons', array( $this, 'ajax_get_drawer_coupons' ) );
	}

	/**
	 * Render the "View Available Coupons" button
	 *
	 * @return void
	 */
	public function render_drawer_button() {
		?>
		<div class="power-coupons-drawer-trigger-wrapper">
			<button type="button" class="power-coupons-view-coupons-btn" id="power-coupons-view-coupons-btn" aria-label="<?php esc_attr_e( 'View available discount coupons', 'power-coupons' ); ?>" aria-expanded="false" aria-controls="power-coupons-drawer">
				<?php echo esc_html( $this->get_text_labels( 'trigger_button_label' ) ); ?>
			</button>
		</div>
		<?php
	}

	/**
	 * Returns text labels based on the text key provided.
	 *
	 * @param string $text_key Text label key.
	 * @return string
	 */
	private function get_text_labels( $text_key ) {
		$texts = $this->settings_helper->get_text_settings();
		$text  = isset( $texts[ $text_key ] ) && is_string( $texts[ $text_key ] ) ? $texts[ $text_key ] : '';
		return ! empty( $text ) ? esc_html( $text ) : '';
	}

	/**
	 * Render the slide-out drawer HTML
	 *
	 * @return void
	 */
	public function render_drawer_html() {
		if ( is_admin() ) {
			// Edge case: Some plugin used wp_footer(); on the admin side template. Bail early if that's the case we are dealing with here.
			return;
		}
		?>
		<?php $display_mode = $this->settings_helper->get( 'general', 'coupon_display_mode', 'drawer' ); ?>
		<div id="power-coupons-drawer" class="power-coupons-drawer" data-display-mode="<?php echo esc_attr( is_string( $display_mode ) ? $display_mode : 'drawer' ); ?>" role="dialog" aria-modal="true" aria-labelledby="power-coupons-drawer-heading" aria-hidden="true">
			<div class="power-coupons-drawer-overlay" aria-hidden="true"></div>
			<div class="power-coupons-drawer-content">
				<div class="power-coupons-drawer-header">
					<?php
					$drawer_heading = $this->get_text_labels( 'drawer_heading' );
					if ( empty( $drawer_heading ) ) {
						$drawer_heading = esc_html__( 'Available Coupons', 'power-coupons' );
					}
					?>
					<h3 id="power-coupons-drawer-heading"><?php echo esc_html( $drawer_heading ); ?></h3>
					<button type="button" class="power-coupons-drawer-close" aria-label="<?php esc_attr_e( 'Close coupon drawer', 'power-coupons' ); ?>">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
							<path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</button>
				</div>
				<div class="power-coupons-drawer-body" role="region" aria-label="<?php esc_attr_e( 'Available Coupons', 'power-coupons' ); ?>">
					<div class="power-coupons-drawer-loading" role="status" aria-live="polite" aria-label="<?php esc_attr_e( 'Loading coupons', 'power-coupons' ); ?>">
						<div class="power-coupons-spinner" aria-hidden="true"></div>
						<p><?php echo esc_html( $this->get_text_labels( 'coupons_loading_text' ) ); ?></p>
					</div>
					<div class="power-coupons-drawer-coupons-list">
						<?php Display_Controller::get_instance()->render_coupon_list( 'slideout' ); ?>
					</div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Enqueue drawer assets
	 *
	 * @return void
	 */
	public function enqueue_drawer_assets() {
		wp_enqueue_style(
			'power-coupons-drawer',
			POWER_COUPONS_URL . 'public/assets/css/checkout-drawer.css',
			array(),
			POWER_COUPONS_VERSION
		);

		wp_enqueue_script(
			'power-coupons-drawer',
			POWER_COUPONS_URL . 'public/assets/js/checkout-drawer.js',
			array( 'jquery', 'power-coupons-cart-refresh' ),
			POWER_COUPONS_VERSION,
			true
		);

		ob_start();
		$this->render_drawer_button();
		$drawer_button = ob_get_clean();

		wp_localize_script(
			'power-coupons-drawer',
			'powerCouponsDrawer',
			array(
				'ajaxUrl'        => admin_url( 'admin-ajax.php' ),
				'nonce'          => wp_create_nonce( 'power-coupons-drawer-nonce' ),
				'showOnCart'     => $this->settings_helper->should_show_on_cart(),
				'showOnCheckout' => $this->settings_helper->should_show_on_checkout(),
				'displayMode'    => $this->settings_helper->get( 'general', 'coupon_display_mode', 'drawer' ),
				'html'           => array(
					'drawerButton' => $drawer_button,
				),
			)
		);
	}

	/**
	 * AJAX handler to get coupons for drawer
	 *
	 * @return void
	 */
	public function ajax_get_drawer_coupons() {
		check_ajax_referer( 'power-coupons-drawer-nonce', 'nonce' );

		$coupons = Power_Coupons_Utilities::get_available_coupons( 0, 'checkout_drawer' );

		if ( empty( $coupons ) ) {
			wp_send_json_success(
				array(
					'html' => '<div class="power-coupons-no-coupons"><p>' . esc_html( $this->get_text_labels( 'no_coupons_text' ) ) . '</p></div>',
				)
			);
		}

		ob_start();
		Display_Controller::get_instance()->render_coupon_list( 'slideout' );
		$html = ob_get_clean();
		wp_send_json_success( array( 'html' => $html ) );
	}
}
