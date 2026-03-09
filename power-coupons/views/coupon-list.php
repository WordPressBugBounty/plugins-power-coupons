<?php
/**
 * Coupon List Template
 *
 * @package Power_Coupons
 * @since 1.0.0
 */

use Power_Coupons\Includes\Power_Coupons_Utilities;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( empty( $all_coupons ) ) {
	return;
}

$power_coupons_card_style_value   = ! empty( $coupon_styling_settings['coupon_style'] ) && 'style-2' === $coupon_styling_settings['coupon_style'] ? 'style-2' : 'style-1'; // TODO: Enhancement from later.
$power_coupons_expiry_text_format = $text_settings['expiry_text_format'] ?? __( 'Expires: {date}', 'power-coupons' );
$power_coupons_coupon_card_array  = Power_Coupons_Utilities::get_coupon_card_templates_array( false, $power_coupons_card_style_value );

// Ensure context is defined.
$context = $context ?? 'default';

?>

<div class="power-coupons-list" data-coupon-card-style="<?php echo esc_attr( $power_coupons_card_style_value ); ?>" data-context="<?php echo esc_attr( $context ); ?>" aria-live="polite" aria-atomic="false">
	<div class="power-coupons-section" role="region" aria-label="<?php esc_attr_e( 'Available Coupons', 'power-coupons' ); ?>">
		<?php
		foreach ( $all_coupons as $power_coupon_coupon ) {

			$power_coupon_coupon_status = 'active';

			if ( ! empty( $power_coupon_coupon['is_applied'] ) ) {
				$power_coupon_coupon_status = 'applied';
			}

			$power_coupons_coupon_card_array['tags'] = [
				'{power_coupon.code}'        => $power_coupon_coupon['code'],
				'{power_coupon.discount}'    => 'percent' === $power_coupon_coupon['type'] ? $power_coupon_coupon['amount'] . '%' : Power_Coupons_Utilities::get_formatted_price( $power_coupon_coupon['amount'] ),
				'{power_coupon.description}' => $power_coupon_coupon['type_text'],
			];

			if ( 'active' === $power_coupon_coupon_status ) {
				if ( empty( $general_settings['show_expiry_info'] ) ) {
					$power_coupons_coupon_card_array['tags']['{power_coupon.status}'] = '';
				} else {
					if ( is_a( $power_coupon_coupon['expiry_date'], 'WC_DateTime' ) ) {
						$power_coupons_coupon_card_array['tags']['{power_coupon.status}'] = str_replace( '{date}', date_i18n( 'd M Y', $power_coupon_coupon['expiry_date']->getTimestamp() ), $power_coupons_expiry_text_format );
					} else {
						$power_coupons_coupon_card_array['tags']['{power_coupon.status}'] = str_replace( '{date}', $power_coupon_coupon['expiry_date'], $power_coupons_expiry_text_format );
					}
				}
			} else {
				$power_coupons_coupon_card_array['tags']['{power_coupon.status}'] = $text_settings['coupon_applied_text'] ?? esc_html__( 'Applied', 'power-coupons' );
			}

			// Generate accessible label for the button.
			$power_coupon_discount_text = 'percent' === $power_coupon_coupon['type'] ? $power_coupon_coupon['amount'] . '%' : Power_Coupons_Utilities::get_formatted_price( $power_coupon_coupon['amount'] );
			$power_coupon_button_label  = 'active' === $power_coupon_coupon_status
				? sprintf(
					/* translators: 1: coupon code, 2: discount amount */
					esc_html__( 'Apply coupon %1$s for %2$s discount', 'power-coupons' ),
					esc_html( $power_coupon_coupon['code'] ),
					esc_html( $power_coupon_discount_text )
				)
				: sprintf(
					/* translators: %s: coupon code */
					esc_html__( 'Coupon %s is already applied', 'power-coupons' ),
					esc_html( $power_coupon_coupon['code'] )
				);

			printf(
				'<button
					type="button"
					class="power-coupons-apply-coupon-btn"
					data-coupon="%1$s"
					data-coupon-status="%2$s"
					aria-label="%4$s"
					aria-pressed="%5$s"
					%3$s
				>',
				esc_attr( $power_coupon_coupon['code'] ),
				esc_attr( $power_coupon_coupon_status ),
				disabled( 'active' !== $power_coupon_coupon_status, true, false ),
				esc_attr( $power_coupon_button_label ),
				'active' === $power_coupon_coupon_status ? 'false' : 'true'
			);
			Power_Coupons_Utilities::render_coupon_card_template( $power_coupons_coupon_card_array );
			echo '</button>';
		}

		?>
	</div>
</div>
