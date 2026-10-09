<?php
/**
 * Utilities Class
 *
 * Provides shared utility methods used across the plugin.
 * Eliminates duplicate code and provides a centralized location for common operations.
 *
 * @package Power_Coupons
 * @since 1.0.0
 */

namespace Power_Coupons\Includes;

use Power_Coupons\Public_Folder\Power_Coupons_Frontend_Rules;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Power_Coupons_Utilities
 *
 * Static utility class providing common helper methods.
 */
class Power_Coupons_Utilities {

	/**
	 * Whether a coupon is currently being applied programmatically rather than by
	 * an explicit user action (e.g. auto-apply, or a PRO offer flow).
	 *
	 * Callers that apply coupons in code should wrap the apply in
	 * `self::$applying_coupon_programmatically = true; ... = false;` so automated
	 * applies stay out of the user-engagement "coupons applied" KPI.
	 *
	 * @since 1.0.4
	 * @var bool
	 */
	public static $applying_coupon_programmatically = false;

	/**
	 * Check if coupon is expired
	 *
	 * Supports both WC_DateTime objects and string dates.
	 *
	 * @param array<string, mixed> $coupon Coupon data array with expiry_date key.
	 * @return bool True if expired, false otherwise.
	 */
	public static function is_coupon_expired( $coupon ) {
		if ( empty( $coupon['expiry_date'] ) ) {
			return false;
		}

		$expiry_date = $coupon['expiry_date'];

		// Handle WC_DateTime objects.
		if ( is_object( $expiry_date ) && $expiry_date instanceof \WC_DateTime ) {
			return $expiry_date->getTimestamp() < time();
		}

		// Handle string dates.
		if ( is_string( $expiry_date ) ) {
			$expiry_timestamp = strtotime( $expiry_date );
			return $expiry_timestamp && $expiry_timestamp < time();
		}

		return false;
	}

	/**
	 * Check if coupon hasn't started yet
	 *
	 * @param array<string, mixed> $coupon Coupon data array with start_date key.
	 * @return bool True if not started, false otherwise.
	 */
	public static function is_coupon_not_started( $coupon ) {
		if ( empty( $coupon['start_date'] ) ) {
			return false;
		}

		$start_timestamp = strtotime( $coupon['start_date'] . ' 00:00:00' );
		return $start_timestamp && time() < $start_timestamp;
	}

	/**
	 * Compare numeric values with operator
	 *
	 * Supports: equal_to, not_equal_to, less_than, less_than_or_equal,
	 * greater_than, greater_than_or_equal
	 *
	 * @param mixed  $actual   The actual value.
	 * @param string $operator The comparison operator.
	 * @param mixed  $expected The expected value.
	 * @return bool True if comparison passes, false otherwise.
	 */
	public static function compare_numeric( $actual, $operator, $expected ) {
		// Convert to numeric if strings.
		$actual   = is_numeric( $actual ) ? (float) $actual : $actual;
		$expected = is_numeric( $expected ) ? (float) $expected : $expected;

		switch ( $operator ) {
			case 'equal_to':
			case 'equals': // Support legacy operator name.
				return $actual === $expected;

			case 'not_equal_to':
			case 'not_equals': // Support legacy operator name.
				return $actual !== $expected;

			case 'less_than':
				return $actual < $expected;

			case 'less_than_or_equal':
				return $actual <= $expected;

			case 'greater_than':
				return $actual > $expected;

			case 'greater_than_or_equal':
				return $actual >= $expected;

			default:
				/*
				 * Fail closed.
				 *
				 * This used to return true. An operator that is not one of the
				 * above can only come from stored rule meta that the rule editor
				 * did not write — a typo, an import, or an operator left behind by
				 * an older version — and passing it turned a *restricted* coupon
				 * into a universally available one. A rule nobody can evaluate is
				 * a rule that has not been satisfied.
				 */
				self::log_unknown_operator( $operator );
				return false;
		}
	}

	/**
	 * Record rule meta that no branch here understands.
	 *
	 * Reaching one of these means a coupon that used to apply has stopped
	 * applying, and the only cause is stored rule meta the rule editor did not
	 * write — imported data, or something left behind by an older version.
	 * Silently failing closed would swap one hard-to-diagnose behaviour for
	 * another, so this goes to the WooCommerce log where a merchant or support
	 * can actually find it (WooCommerce → Status → Logs, source
	 * `power-coupons`), falling back to `error_log()` only when WooCommerce's
	 * logger is unavailable.
	 *
	 * Deduplicated per distinct problem per request: these branches are reached
	 * once per coupon per cart evaluation, so an affected store would otherwise
	 * fill its log with the same line on every page view.
	 *
	 * @since 1.0.7
	 * @param string $key     Dedupe key identifying the specific problem.
	 * @param string $message Human-readable description.
	 * @return void
	 */
	public static function log_rule_anomaly( $key, $message ) {
		static $already_logged = array();

		if ( isset( $already_logged[ $key ] ) ) {
			return;
		}
		$already_logged[ $key ] = true;

		if ( function_exists( 'wc_get_logger' ) ) {
			wc_get_logger()->warning( $message, array( 'source' => 'power-coupons' ) );
			return;
		}

		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( 'Power Coupons: ' . $message ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Fallback when WooCommerce's logger is unavailable.
		}
	}

	/**
	 * Record an operator that no comparison branch understands.
	 *
	 * @param string $operator The unrecognised operator.
	 * @return void
	 */
	private static function log_unknown_operator( $operator ) {
		$operator = (string) $operator;

		$message = '' === $operator
			? 'A conditional rule has no operator set. The rule was treated as not satisfied, so any coupon using it will not apply. Re-save the coupon\'s rules to repair it.'
			: sprintf(
				'Unknown conditional-rule operator "%s" in coupon rule meta. The rule was treated as not satisfied, so any coupon using it will not apply. Re-save the coupon\'s rules to repair it.',
				$operator
			);

		self::log_rule_anomaly( 'operator:' . $operator, $message );
	}

	/**
	 * Check if WooCommerce is active
	 *
	 * @return bool True if WooCommerce is active.
	 */
	public static function is_woocommerce_active() {
		return class_exists( 'WooCommerce' ) || function_exists( 'WC' );
	}

	/**
	 * Check if WooCommerce cart exists and is not empty
	 *
	 * @return bool True if cart exists and has items.
	 */
	public static function is_cart_available() {
		return self::is_woocommerce_active() && null !== WC()->cart && ! WC()->cart->is_empty();
	}

	/**
	 * Sanitize coupon code
	 *
	 * @param string $code The coupon code to sanitize.
	 * @return string Sanitized coupon code.
	 */
	public static function sanitize_coupon_code( $code ) {
		return sanitize_text_field( strtolower( $code ) );
	}

	/**
	 * Format discount amount for display
	 *
	 * @param float  $amount The discount amount.
	 * @param string $type   The discount type (percent, fixed_cart, fixed_product).
	 * @return string Formatted discount amount.
	 */
	public static function format_discount_amount( $amount, $type ) {
		switch ( $type ) {
			case 'percent':
				return $amount . '%';

			case 'fixed_cart':
			case 'fixed_product':
				return wc_price( $amount );

			default:
				return (string) $amount;
		}
	}

	/**
	 * Get current cart total
	 *
	 * @return float Cart total or 0 if cart not available.
	 */
	public static function get_cart_total() {
		if ( ! self::is_cart_available() ) {
			return 0;
		}

		return (float) WC()->cart->get_cart_contents_total();
	}

	/**
	 * Get current cart item count
	 *
	 * @return int Number of items in cart.
	 */
	public static function get_cart_item_count() {
		if ( ! self::is_cart_available() ) {
			return 0;
		}

		return WC()->cart->get_cart_contents_count();
	}

	/**
	 * Get array of coupon card templates
	 *
	 * Returns filtered array of available coupon card templates with their paths and template tags.
	 * Each template has a path to the template file and an array of supported template tags.
	 *
	 * @since 1.0.0
	 * @param bool   $pre_rendered Whether templates are pre-rendered.
	 * @param string $key Template key identifier.
	 * @return array<string, mixed> Array of template configurations with paths and tags
	 */
	public static function get_coupon_card_templates_array( $pre_rendered = true, $key = '' ) {
		$templates = apply_filters(
			'power_coupons_filter_coupon_card_templates_array',
			[
				'style-1' => [
					'label' => __( 'Ticket', 'power-coupons' ),
					'path'  => POWER_COUPONS_DIR . 'views/templates/card-style-1.php',
					'tags'  => [
						'{power_coupon.code}'        => 'EUSHDKQO',
						'{power_coupon.discount}'    => '$10',
						'{power_coupon.description}' => 'Cart Discount',
						'{power_coupon.status}'      => 'Valid Till: 01 Feb 2022',
					],
				],
				'style-2' => [
					'label' => __( 'Card', 'power-coupons' ),
					'path'  => POWER_COUPONS_DIR . 'views/templates/card-style-2.php',
					'tags'  => [
						'{power_coupon.code}'        => 'EUSHDKQO',
						'{power_coupon.discount}'    => '$10',
						'{power_coupon.description}' => 'Cart Discount',
						'{power_coupon.status}'      => 'Valid Till: 01 Feb 2022',
					],
				],
			]
		);

		if ( $pre_rendered ) {
			foreach ( $templates as &$template_args ) {
				$template_args = self::render_coupon_card_template( $template_args, false );
			}
		}

		if ( ! empty( $key ) ) {
			return isset( $templates[ $key ] ) ? $templates[ $key ] : null;
		}

		return $templates;
	}

	/**
	 * Get the display name for each coupon card template.
	 *
	 * Kept separate from the rendered markup so the picker can name each option.
	 * Templates added through `power_coupons_filter_coupon_card_templates_array`
	 * that declare no label fall back to a numbered name.
	 *
	 * @since 1.0.8
	 * @return array<string, string> Map of template key to display name.
	 */
	public static function get_coupon_card_template_labels() {
		$templates = self::get_coupon_card_templates_array( false );
		$labels    = array();
		$position  = 0;

		foreach ( $templates as $key => $template ) {
			++$position;

			$label = is_array( $template ) && isset( $template['label'] ) && is_string( $template['label'] )
				? $template['label']
				: '';

			$labels[ $key ] = '' !== $label
				? $label
				: sprintf(
					/* translators: %d: coupon style number. */
					__( 'Style %d', 'power-coupons' ),
					$position
				);
		}

		return $labels;
	}

	/**
	 * Render coupon card template with provided arguments.
	 *
	 * Takes a template configuration array and renders the template file with the provided
	 * tag replacements. Can either echo the rendered content or return it as a string.
	 *
	 * @since 1.0.0
	 * @param array<string, mixed> $template_args Template arguments including path and template tags.
	 * @param bool                 $echo         Whether to echo the rendered template (default: true).
	 * @return mixed Rendered template string if $echo is false, original args if template not found.
	 */
	public static function render_coupon_card_template( $template_args, $echo = true ) {
		$template_path = isset( $template_args['path'] ) && is_string( $template_args['path'] ) ? $template_args['path'] : '';
		if ( empty( $template_path ) || ! file_exists( $template_path ) ) {
			return $template_args;
		}

		ob_start();
		include $template_path;
		$content = ob_get_clean();

		if ( false === $content ) {
			$content = '';
		}

		$tags         = isset( $template_args['tags'] ) && is_array( $template_args['tags'] ) ? $template_args['tags'] : array();
		$escaped_tags = array_map( 'esc_html', $tags );
		$content      = str_replace( array_keys( $tags ), array_values( $escaped_tags ), $content );

		if ( $echo ) {
			echo wp_kses( $content, self::get_wp_kses_allowed_html_for_svg() );
		}

		return $content;
	}

	/**
	 * Get allowed HTML tags and attributes for SVG content
	 *
	 * Returns an array of allowed HTML tags and their attributes that can be safely
	 * rendered through wp_kses() when displaying SVG content. This includes support for:
	 * - SVG root element and basic attributes
	 * - Path elements for drawing
	 * - Rectangle elements
	 * - Text elements
	 * - Foreign objects for embedding HTML
	 * - Div elements within foreign objects
	 *
	 * @since 1.0.0
	 * @return array<string, array<string, bool>> Array of allowed HTML tags and attributes
	 */
	public static function get_wp_kses_allowed_html_for_svg() {
		return [
			'svg'           => [
				'xmlns'   => true,
				'width'   => true,
				'height'  => true,
				'viewBox' => true,
				'fill'    => true,
			],
			'path'          => [
				'd'                => true,
				'fill'             => true,
				'stroke'           => true,
				'stroke-width'     => true,
				'stroke-linejoin'  => true,
				'stroke-dasharray' => true,
			],
			'rect'          => [
				'x'      => true,
				'y'      => true,
				'width'  => true,
				'height' => true,
				'rx'     => true,
				'fill'   => true,
				'stroke' => true,
			],
			'text'          => [
				'x'           => true,
				'y'           => true,
				'fill'        => true,
				'font-family' => true,
				'font-size'   => true,
				'class'       => true,
				'style'       => true,
			],
			'foreignobject' => [
				'x'      => true,
				'y'      => true,
				'width'  => true,
				'height' => true,
				'style'  => true,
			],
			'div'           => [
				'class' => true,
				'style' => true,
			],
		];
	}

	/**
	 * Helper function for getting formatted price
	 *
	 * @since 1.0.0
	 * @param float $amount Amount.
	 * @return string Formatted price.
	 */
	public static function get_formatted_price( $amount ) {
		$currency     = get_woocommerce_currency_symbol();
		$currency_pos = get_option( 'woocommerce_currency_pos' );

		switch ( $currency_pos ) {
			case 'left':
				return $currency . $amount;
			case 'left_space':
				return $currency . ' ' . $amount;
			case 'right_space':
				return $amount . ' ' . $currency;
			default:
				return $amount . $currency;
		}
	}

	/**
	 * Checks whether or not current viewing page is CartFlows Checkout page.
	 *
	 * @return bool
	 */
	public static function is_cartflows_checkout() {
		if ( function_exists( '_is_wcf_checkout_type' ) ) {
			return _is_wcf_checkout_type();
		}

		return false;
	}

	/**
	 * Determine whether a coupon was created using Power Coupons.
	 *
	 * A coupon qualifies when the store owner has intentionally opted into a
	 * Power Coupons feature on it. Detection is value-based, not presence-based:
	 * `_power_coupon_auto_apply` and `_power_coupon_show_in_slideout` are written
	 * ('yes'/'no') on every coupon saved through the WooCommerce coupon editor,
	 * so only the 'yes' value indicates a deliberate Power Coupons coupon.
	 *
	 * Free coverage: auto-apply, slideout display, and rule conditions. The
	 * `power_coupons_is_power_coupons_coupon` filter lets the PRO plugin augment
	 * detection for its own coupon types (gift cards, BOGO). The filter is a
	 * no-op when PRO is inactive.
	 *
	 * @since 1.0.2
	 * @param \WC_Coupon $coupon WooCommerce coupon object.
	 * @return bool True if the coupon was created using Power Coupons.
	 */
	public static function is_power_coupons_coupon( $coupon ) {
		if ( ! $coupon instanceof \WC_Coupon ) {
			return false;
		}

		$coupon_id = $coupon->get_id();

		if ( $coupon_id <= 0 ) {
			return false;
		}

		$is_power_coupon = 'yes' === get_post_meta( $coupon_id, '_power_coupon_auto_apply', true )
			|| 'yes' === get_post_meta( $coupon_id, '_power_coupon_show_in_slideout', true )
			|| 'yes' === get_post_meta( $coupon_id, '_pc_rule_enable_conditions', true );

		/**
		 * Filter whether a coupon was created using Power Coupons.
		 *
		 * Allows the PRO plugin to mark its own coupon types (gift cards, BOGO)
		 * as Power Coupons coupons. Returning true short-circuits detection.
		 *
		 * @since 1.0.2
		 * @param bool       $is_power_coupon Whether the coupon is a Power Coupons coupon (free detection).
		 * @param \WC_Coupon $coupon          WooCommerce coupon object.
		 */
		return (bool) apply_filters( 'power_coupons_is_power_coupons_coupon', $is_power_coupon, $coupon );
	}

	/**
	 * Whether or not to reload current page after coupon is successfully applied.
	 *
	 * Defaults to false. Coupon apply/remove and credit redemption refresh the
	 * cart UI in place through `public/assets/js/cart-refresh.js`, using each
	 * context's native mechanism (the `wc/store/cart` data store on Cart and
	 * Checkout Blocks, `update_checkout` on the classic checkout,
	 * `wc_update_cart` on the classic cart).
	 *
	 * A full page reload discards in-page state that multi-step checkout
	 * plugins such as CartFlows and FunnelKit hold in the browser, sending the
	 * shopper back to step one. Reloading is therefore opt-in: return true from
	 * the filter below only for a theme or integration that genuinely cannot
	 * refresh without one.
	 *
	 * @since 1.0.2
	 * @return bool
	 */
	public static function reload_page_after_coupon_is_applied() {
		/**
		 * Filter whether to reload the page after a coupon is applied.
		 *
		 * @since 1.0.2
		 * @param bool $reload Whether to reload. Default false.
		 */
		return (bool) apply_filters( 'power_coupons_reload_page_after_coupon_is_applied', false );
	}

	/**
	 * Get the coupons available for display in the current request.
	 *
	 * Single source of truth for "which coupons may a shopper see". Both the
	 * coupon list (`Display_Controller`) and the checkout drawer
	 * (`Checkout_Drawer_Controller`) call this so the two can never disagree
	 * about which coupons are eligible.
	 *
	 * The underlying query and eligibility pass are cached per request and
	 * shared across contexts; only the `power_coupons_available_coupons` filter
	 * runs per call, so each context still gets its own filter pass.
	 *
	 * @since x.x.x
	 *
	 * @param int    $coupon_id Optional specific coupon ID. 0 for all coupons.
	 * @param string $context   Display context — 'coupon_list' or 'checkout_drawer'.
	 * @return array<int, array<string, mixed>>
	 */
	public static function get_available_coupons( $coupon_id = 0, $context = 'coupon_list' ) {
		$coupons = self::query_available_coupons( (int) $coupon_id );

		/**
		 * Filter the available coupons before display.
		 *
		 * @since x.x.x
		 *
		 * @param array  $coupons Array of coupon data arrays.
		 * @param string $context Display context — 'coupon_list' or 'checkout_drawer'.
		 */
		return apply_filters( 'power_coupons_available_coupons', $coupons, $context );
	}

	/**
	 * Query and validate the displayable coupons, cached per request.
	 *
	 * @since x.x.x
	 *
	 * @param int $coupon_id Optional specific coupon ID. 0 for all coupons.
	 * @return array<int, array<string, mixed>>
	 */
	private static function query_available_coupons( $coupon_id = 0 ) {
		static $caches = array();

		$cache_key = 'pc_available_coupons_' . $coupon_id;

		if ( isset( $caches[ $cache_key ] ) ) {
			return $caches[ $cache_key ];
		}

		$args = array(
			'post_type'      => 'shop_coupon',
			'post_status'    => 'publish',
			'posts_per_page' => 50,
			'fields'         => 'ids',
			'meta_query'     => array(
				array(
					'key'     => 'discount_type',
					'value'   => 'power_coupons_bogo',
					'compare' => '!=',
				),
				// Exclude gift card coupons — they are personal, recipient-specific codes.
				array(
					'key'     => '_power_coupon_gift_card',
					'compare' => 'NOT EXISTS',
				),
			),
		);

		if ( $coupon_id ) {
			$args['p']              = $coupon_id;
			$args['posts_per_page'] = 1;
		}

		$coupon_ids = get_posts( $args );

		if ( empty( $coupon_ids ) ) {
			$caches[ $cache_key ] = array();
			return array();
		}

		$general_settings = Power_Coupons_Settings_Helper::get_instance()->get_general_settings();

		$show_applied_coupons = ! empty( $general_settings['show_applied_coupons'] );

		// Bulk fetch all meta at once to avoid N+1 queries.
		update_meta_cache( 'post', $coupon_ids );

		$coupons = array();

		// Get the rules validator instance.
		$rules_validator = Power_Coupons_Frontend_Rules::get_instance();

		foreach ( $coupon_ids as $id ) {
			$id = (int) $id;

			$coupon = new \WC_Coupon( $id );

			$code = $coupon->get_code();

			$is_applied = self::is_coupon_applied( $code );

			if ( ! $show_applied_coupons && $is_applied ) {
				// Hide the applied coupons if show applied coupons setting is disabled.
				continue;
			}

			// Only show coupons explicitly enabled for slideout display.
			if ( 'yes' !== get_post_meta( $id, '_power_coupon_show_in_slideout', true ) ) {
				continue;
			}

			// Check if coupon meets conditional rules (if enabled).
			// Invalid coupons are hidden from display.
			if ( ! $rules_validator->is_coupon_valid( $id ) ) {
				continue; // Skip this coupon - it doesn't meet the rules.
			}

			$start_date    = get_post_meta( $id, '_power_coupon_start_date', true );
			$coupon_expiry = $coupon->get_date_expires();

			// Skip coupons that have not started yet, or that have already expired.
			if ( self::is_coupon_not_started( array( 'start_date' => $start_date ) ) ) {
				continue;
			}

			if ( self::is_coupon_expired( array( 'expiry_date' => $coupon_expiry ) ) ) {
				continue;
			}

			$coupon_type = $coupon->get_discount_type();

			$coupons[] = array(
				'id'          => $id,
				'code'        => $code,
				'description' => $coupon->get_description(),
				'amount'      => $coupon->get_amount(),
				'type'        => $coupon_type,
				'type_text'   => self::get_coupon_type_text( $coupon_type ),
				'expiry_date' => ! empty( $coupon_expiry ) ? $coupon_expiry : __( 'NA', 'power-coupons' ),
				'auto_apply'  => get_post_meta( $id, '_power_coupon_auto_apply', true ),
				'start_date'  => $start_date,
				'is_applied'  => $is_applied,
			);
		}

		$caches[ $cache_key ] = $coupons;

		return $coupons;
	}

	/**
	 * Check if a coupon is currently applied to the cart.
	 *
	 * @since x.x.x
	 *
	 * @param string $coupon_code Coupon code.
	 * @return bool
	 */
	public static function is_coupon_applied( $coupon_code ) {
		if ( ! self::is_woocommerce_active() ) {
			return false;
		}

		$cart = WC()->cart;

		return $cart instanceof \WC_Cart && $cart->has_discount( $coupon_code );
	}

	/**
	 * Get human-readable text for a coupon discount type.
	 *
	 * @since x.x.x
	 *
	 * @param string $type Coupon discount type (e.g., 'percent', 'fixed_cart', 'fixed_product').
	 * @return string Localized type description, or empty string if unknown.
	 */
	public static function get_coupon_type_text( $type = '' ) {
		switch ( $type ) {
			case 'percent':
				return __( 'Percent Discount', 'power-coupons' );

			case 'fixed_cart':
				return __( 'Cart Discount', 'power-coupons' );

			case 'fixed_product':
				return __( 'Product Discount', 'power-coupons' );

			default:
				return '';
		}
	}
}
