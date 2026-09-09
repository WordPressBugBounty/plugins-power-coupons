<?php
/**
 * Public Rules Class
 *
 * Handles frontend validation of conditional rules for WooCommerce coupons.
 * Supports multiple rule groups with OR logic between groups and AND logic within groups.
 * Invalid coupons are hidden from display rather than showing error messages.
 *
 * @package    Power_Coupons
 * @subpackage Power_Coupons/Public
 * @since      1.0.0
 */

namespace Power_Coupons\Public_Folder;

use Power_Coupons\Includes\Power_Coupons_Rules_Registry;
use Power_Coupons\Includes\Power_Coupons_Utilities;
use Power_Coupons\Includes\Traits\Power_Coupons_Singleton;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Power_Coupons_Frontend_Rules
 *
 * Validates conditional rules on the frontend with support for operators.
 * Returns false quietly for invalid coupons to hide them from customers.
 */
class Power_Coupons_Frontend_Rules {

	use Power_Coupons_Singleton;

	/**
	 * Constructor
	 */
	protected function __construct() {
		$this->init_hooks();
	}

	/**
	 * Initialize WordPress hooks
	 *
	 * @return void
	 */
	private function init_hooks() {
		// Main coupon validation hook - high priority to run early.
		add_filter( 'woocommerce_coupon_is_valid', array( $this, 'validate_conditional_rules' ), 5, 2 );
	}

	/**
	 * Validate conditional rules for a coupon
	 *
	 * Returns false quietly if rules don't pass, so coupon is hidden from display.
	 * Does not throw exceptions to avoid showing error messages to customers.
	 *
	 * Logic: OR between groups, AND within groups.
	 * - At least ONE group must be valid (OR)
	 * - ALL conditions within a group must be valid (AND)
	 *
	 * @param bool       $is_valid Whether the coupon is currently valid.
	 * @param \WC_Coupon $coupon   WooCommerce coupon object.
	 *
	 * @return bool True if valid, false otherwise.
	 */
	public function validate_conditional_rules( $is_valid, $coupon ) {
		// Early return if already invalid.
		if ( ! $is_valid ) {
			return $is_valid;
		}

		$coupon_id = $coupon->get_id();

		// Check if rules are enabled.
		if ( ! Power_Coupons_Rules_Registry::are_rules_enabled( $coupon_id ) ) {
			return $is_valid;
		}

		// Skip validation in admin.
		if ( is_admin() && ! wp_doing_ajax() ) {
			return $is_valid;
		}

		// Get all rule groups.
		$groups = Power_Coupons_Rules_Registry::get_rule_groups( $coupon_id );

		if ( empty( $groups ) ) {
			return $is_valid;
		}

		// OR logic between groups: At least ONE group must be valid.
		foreach ( $groups as $group ) {
			if ( $this->validate_group( $group ) ) {
				// At least one group is valid, coupon is valid.
				return true;
			}
		}

		// No groups were valid, hide the coupon.
		return false;
	}

	/**
	 * Validate a single rule group
	 *
	 * AND logic: ALL rules within the group must be valid.
	 *
	 * @param array<string, mixed> $group Rule group data.
	 *
	 * @return bool True if all rules in group are valid, false otherwise.
	 */
	private function validate_group( $group ) {
		// Check if group has rules.
		if ( empty( $group['rules'] ) || ! is_array( $group['rules'] ) ) {
			return true; // Empty group is always valid.
		}

		// AND logic: All rules must pass.
		foreach ( $group['rules'] as $rule ) {
			if ( ! $this->validate_rule( $rule ) ) {
				return false; // One rule failed, group fails.
			}
		}

		return true; // All rules passed.
	}

	/**
	 * Validate a single rule based on its type and operator
	 *
	 * @param array<string, mixed> $rule Rule data with type, operator, and value.
	 *
	 * @return bool True if rule is valid, false otherwise.
	 */
	private function validate_rule( $rule ) {
		// Skip if rule has no value set (empty/unset condition always passes).
		if ( ! isset( $rule['value'] ) || '' === $rule['value'] ) {
			return true;
		}

		$type     = isset( $rule['type'] ) && is_string( $rule['type'] ) ? $rule['type'] : '';
		$operator = isset( $rule['operator'] ) && is_string( $rule['operator'] ) ? $rule['operator'] : '';
		$value    = $rule['value'];

		// Validate based on rule type.
		switch ( $type ) {
			case 'cart_total':
				$operator_str = is_scalar( $operator ) ? (string) $operator : 'equals';
				return $this->validate_cart_total_rule( $operator_str, $value );

			case 'cart_items':
				$operator_str = is_scalar( $operator ) ? (string) $operator : 'equals';
				return $this->validate_cart_items_rule( $operator_str, $value );

			case 'products':
				$operator_str = is_scalar( $operator ) ? (string) $operator : 'equals';
				return $this->validate_products_rule( $operator_str, $value );

			case 'product_categories':
				$operator_str = is_scalar( $operator ) ? (string) $operator : 'equals';
				return $this->validate_categories_rule( $operator_str, $value );

			default:
				/*
				 * Fail closed, for the same reason as the unknown-operator
				 * branch in Power_Coupons_Utilities::compare_numeric().
				 *
				 * `Rules_Registry::sanitize_rule()` rejects any type outside the
				 * four valid ones, so an unknown type can only come from rule
				 * meta the editor did not write. Passing it turned a restricted
				 * coupon into a universally available one; a restriction nobody
				 * can evaluate has not been satisfied.
				 */
				Power_Coupons_Utilities::log_rule_anomaly(
					'type:' . $type,
					'' === $type
						? 'A conditional rule has no type set. The rule was treated as not satisfied, so any coupon using it will not apply. Re-save the coupon\'s rules to repair it.'
						: sprintf(
							'Unknown conditional-rule type "%s" in coupon rule meta. The rule was treated as not satisfied, so any coupon using it will not apply. Re-save the coupon\'s rules to repair it.',
							$type
						)
				);
				return false;
		}
	}

	/**
	 * Validate cart total rule with operator
	 *
	 * @param string $operator Comparison operator.
	 * @param mixed  $value    Value to compare against.
	 *
	 * @return bool True if valid, false otherwise.
	 */
	private function validate_cart_total_rule( $operator, $value ) {
		if ( ! WC()->cart ) {
			return false;
		}

		$cart       = WC()->cart;
		$cart_total = $cart->get_subtotal();
		$value      = is_numeric( $value ) ? floatval( $value ) : 0.0;

		return Power_Coupons_Utilities::compare_numeric( $cart_total, $operator, $value );
	}

	/**
	 * Validate cart items count rule with operator
	 *
	 * @param string $operator Comparison operator.
	 * @param mixed  $value    Value to compare against.
	 *
	 * @return bool True if valid, false otherwise.
	 */
	private function validate_cart_items_rule( $operator, $value ) {
		if ( ! WC()->cart ) {
			return false;
		}

		$cart             = WC()->cart;
		$cart_items_count = count( $cart->get_cart() );
		$value            = is_numeric( $value ) ? intval( $value ) : 0;

		return Power_Coupons_Utilities::compare_numeric( $cart_items_count, $operator, $value );
	}

	/**
	 * Normalise a rule value into a list of positive integer IDs.
	 *
	 * The rule editor writes a single integer and `Rules_Registry::sanitize_rule()`
	 * stores one, but the docblocks here long promised "an array of IDs" and
	 * imported or hand-written meta can hold either. The old guard bailed with
	 * `true` on anything that was not an int, which meant an array-valued rule
	 * silently lifted the restriction instead of applying it — the coupon became
	 * universally valid. Accepting both shapes removes that failure mode without
	 * failing closed on rules that merely have nothing configured yet.
	 *
	 * Cast with `(int)`, never `absint()`: `absint( -3 )` is `3`, which would
	 * silently turn a malformed value into a restriction on a *different*,
	 * real product. A value that is not a positive ID is dropped.
	 *
	 * @param mixed $value Raw rule value: an ID, a numeric string, or a list of either.
	 * @return array<int, int> Positive IDs, empty when nothing usable was configured.
	 */
	private static function normalize_id_list( $value ) {
		$ids = array();

		foreach ( (array) $value as $candidate ) {
			if ( ! is_scalar( $candidate ) || ! is_numeric( $candidate ) ) {
				continue;
			}

			$id = (int) $candidate;
			if ( $id > 0 ) {
				$ids[] = $id;
			}
		}

		return array_values( array_unique( $ids ) );
	}

	/**
	 * Validate products in cart rule with operator
	 *
	 * The rule editor is a single select, so a configured value is normally one
	 * product ID. Legacy and imported rules can hold a list, so both shapes are
	 * accepted and normalised here — see self::normalize_id_list().
	 *
	 * @param string $operator Comparison operator (in_list or not_in_list).
	 * @param mixed  $value    Product ID, or list of product IDs; any shape is
	 *                         normalised by self::normalize_id_list().
	 *
	 * @return bool True if valid, false otherwise.
	 */
	private function validate_products_rule( $operator, $value ) {
		$wanted_ids = self::normalize_id_list( $value );

		if ( empty( $wanted_ids ) ) {
			return true; // Nothing configured — no restriction to apply.
		}

		if ( ! WC()->cart ) {
			return false;
		}

		$cart = WC()->cart;

		// Get product IDs in cart (including variations).
		$cart_product_ids = array();
		foreach ( $cart->get_cart() as $cart_item ) {
			$cart_product_ids[] = $cart_item['product_id'];
			if ( isset( $cart_item['variation_id'] ) && $cart_item['variation_id'] > 0 ) {
				$cart_product_ids[] = $cart_item['variation_id'];
			}
		}
		$cart_product_ids = array_map( 'absint', array_unique( $cart_product_ids ) );

		// Check for matches.
		$has_match = (bool) array_intersect( $wanted_ids, $cart_product_ids );

		// Apply operator.
		switch ( $operator ) {
			case 'in_list':
				return $has_match;

			case 'not_in_list':
				return ! $has_match;

			default:
				/*
				 * Fail closed — see Power_Coupons_Utilities::compare_numeric().
				 * An operator this validator cannot evaluate is a restriction we
				 * cannot confirm, so the rule counts as unsatisfied rather than
				 * silently lifting the restriction.
				 *
				 * Logged for the same reason as the numeric branch: repair at
				 * save time only touches operators that map confidently, so a
				 * stored products rule with a stale operator lands here and
				 * would otherwise stop the coupon applying with nothing to
				 * explain why.
				 */
				Power_Coupons_Utilities::log_rule_anomaly(
					'list-operator:' . $operator,
					'' === $operator
						? 'A products conditional rule has no operator set. The rule was treated as not satisfied, so any coupon using it will not apply. Re-save the coupon\'s rules to repair it.'
						: sprintf(
							'Unknown operator "%s" on a products conditional rule. The rule was treated as not satisfied, so any coupon using it will not apply. Re-save the coupon\'s rules to repair it.',
							$operator
						)
				);
				return false;
		}
	}

	/**
	 * Validate product categories in cart rule with operator
	 *
	 * Accepts the same value shapes as self::validate_products_rule().
	 *
	 * @param string $operator Comparison operator (in_list or not_in_list).
	 * @param mixed  $value    Category ID, or list of category IDs; any shape is
	 *                         normalised by self::normalize_id_list().
	 *
	 * @return bool True if valid, false otherwise.
	 */
	private function validate_categories_rule( $operator, $value ) {
		$wanted_ids = self::normalize_id_list( $value );

		if ( empty( $wanted_ids ) ) {
			return true; // Nothing configured — no restriction to apply.
		}

		if ( ! WC()->cart ) {
			return false;
		}

		$cart = WC()->cart;

		// Get all categories from cart products.
		$cart_categories = array();
		foreach ( $cart->get_cart() as $cart_item ) {
			$product_id = $cart_item['product_id'];
			$terms      = get_the_terms( $product_id, 'product_cat' );

			if ( $terms && ! is_wp_error( $terms ) ) {
				foreach ( $terms as $term ) {
					$cart_categories[] = $term->term_id;
				}
			}
		}
		$cart_categories = array_map( 'absint', array_unique( $cart_categories ) );

		// Check for matches.
		$has_match = (bool) array_intersect( $wanted_ids, $cart_categories );

		// Apply operator.
		switch ( $operator ) {
			case 'in_list':
				return $has_match;

			case 'not_in_list':
				return ! $has_match;

			default:
				/*
				 * Fail closed — see Power_Coupons_Utilities::compare_numeric().
				 * An operator this validator cannot evaluate is a restriction we
				 * cannot confirm, so the rule counts as unsatisfied rather than
				 * silently lifting the restriction.
				 *
				 * Logged for the same reason as the numeric branch: repair at
				 * save time only touches operators that map confidently, so a
				 * stored product categories rule with a stale operator lands here and
				 * would otherwise stop the coupon applying with nothing to
				 * explain why.
				 */
				Power_Coupons_Utilities::log_rule_anomaly(
					'list-operator:' . $operator,
					'' === $operator
						? 'A product categories conditional rule has no operator set. The rule was treated as not satisfied, so any coupon using it will not apply. Re-save the coupon\'s rules to repair it.'
						: sprintf(
							'Unknown operator "%s" on a product categories conditional rule. The rule was treated as not satisfied, so any coupon using it will not apply. Re-save the coupon\'s rules to repair it.',
							$operator
						)
				);
				return false;
		}
	}

	/**
	 * Check if a specific coupon is valid based on conditional rules
	 *
	 * Public method that can be called from other classes to check validity.
	 * Useful for filtering coupons before display.
	 *
	 * @param int $coupon_id Coupon post ID.
	 *
	 * @return bool True if valid, false otherwise.
	 */
	public function is_coupon_valid( $coupon_id ) {
		// Check if rules are enabled.
		if ( ! Power_Coupons_Rules_Registry::are_rules_enabled( $coupon_id ) ) {
			return true; // No rules means always valid.
		}

		/*
		 * Same escape hatch as validate_conditional_rules().
		 *
		 * Cart-dependent rules cannot be evaluated on an admin screen, where
		 * there is no shopper cart to evaluate them against, and this method is
		 * used to decide what appears in a listing rather than whether a coupon
		 * may be applied. Without this, every rule-enabled coupon disappeared
		 * from admin-side listings.
		 */
		if ( is_admin() && ! wp_doing_ajax() ) {
			return true;
		}

		// Get all rule groups.
		$groups = Power_Coupons_Rules_Registry::get_rule_groups( $coupon_id );

		if ( empty( $groups ) ) {
			return true;
		}

		// OR logic between groups: At least ONE group must be valid.
		foreach ( $groups as $group ) {
			if ( $this->validate_group( $group ) ) {
				return true;
			}
		}

		// No groups were valid.
		return false;
	}

	/**
	 * Filter coupons array to only include valid ones
	 *
	 * @param array<int, mixed> $coupons Array of coupon codes or IDs.
	 *
	 * @return array<int, mixed> Filtered array of valid coupons.
	 */
	public function filter_valid_coupons( $coupons ) {
		if ( empty( $coupons ) ) {
			return $coupons;
		}

		$valid_coupons = array();

		foreach ( $coupons as $key => $coupon ) {
			$coupon_id = 0;

			// Handle different input formats.
			if ( is_numeric( $coupon ) ) {
				$coupon_id = intval( $coupon );
			} elseif ( is_string( $coupon ) ) {
				// It's a coupon code, get the ID.
				$coupon_obj = new \WC_Coupon( $coupon );
				$coupon_id  = $coupon_obj->get_id();
			} elseif ( is_object( $coupon ) && method_exists( $coupon, 'get_id' ) ) {
				$coupon_id = $coupon->get_id();
			}

			// Check if coupon is valid.
			if ( $coupon_id && $this->is_coupon_valid( $coupon_id ) ) {
				$valid_coupons[ $key ] = $coupon;
			}
		}

		return $valid_coupons;
	}
}
