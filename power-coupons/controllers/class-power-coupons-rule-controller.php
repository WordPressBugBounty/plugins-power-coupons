<?php
/**
 * Rule Controller Class
 *
 * @package Power_Coupons
 * @since 1.0.0
 */

namespace Power_Coupons\Controllers;

use Power_Coupons\Models\Power_Coupons_Rule_Model;
use Power_Coupons\Models\Power_Coupons_Cart_Model;

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Class Rule_Controller
 */
class Rule_Controller {

	/**
	 * Rule Model instance
	 *
	 * @var Power_Coupons_Rule_Model
	 */
	private $rule_model;

	/**
	 * Constructor
	 *
	 * @since 1.0.0
	 */
	public function __construct() {
		$this->rule_model = new Power_Coupons_Rule_Model();
		new Power_Coupons_Cart_Model();
	}

	/**
	 * Evaluate rules for coupon
	 *
	 * @param int $coupon_id Coupon ID.
	 * @since 1.0.0
	 * @return bool True if rules pass, false otherwise.
	 */
	public function evaluate_rules( $coupon_id ) {
		$rules = $this->rule_model->get_by_coupon( $coupon_id );

		if ( ! isset( $rules['conditions'] ) || empty( $rules['conditions'] ) ) {
			return true; // No conditions means always valid.
		}

		$cart_model = new Power_Coupons_Cart_Model();
		$cart_data  = $cart_model->get_cart_data();
		$logic      = ! empty( $rules['logic'] ) ? $rules['logic'] : 'AND';
		$results    = array();

		$conditions = isset( $rules['conditions'] ) && is_array( $rules['conditions'] ) ? $rules['conditions'] : array();
		foreach ( $conditions as $condition ) {
			if ( is_array( $condition ) ) {
				$results[] = $this->evaluate_condition( $condition, $cart_data );
			}
		}

		// Apply logic (AND/OR).
		if ( 'AND' === $logic ) {
			return ! in_array( false, $results, true );
		} else {
			return in_array( true, $results, true );
		}
	}

	/**
	 * Evaluate single condition
	 *
	 * @param array<string, mixed> $condition Condition data.
	 * @param array<string, mixed> $cart_data Cart data.
	 * @since 1.0.0
	 * @return bool
	 */
	private function evaluate_condition( $condition, $cart_data ) {
		$type     = isset( $condition['type'] ) && is_string( $condition['type'] ) ? $condition['type'] : '';
		$operator = isset( $condition['operator'] ) && is_scalar( $condition['operator'] ) ? (string) $condition['operator'] : 'equals';
		$value    = isset( $condition['value'] ) ? $condition['value'] : '';

		switch ( $type ) {
			case 'cart_total':
				return $this->compare_values( $cart_data['total'], $operator, $value );

			case 'product_count':
				return $this->compare_values( $cart_data['item_count'], $operator, $value );

			case 'product_category':
				$category_ids      = isset( $condition['category_ids'] ) && is_array( $condition['category_ids'] ) ? $condition['category_ids'] : array();
				$cart_category_ids = isset( $cart_data['category_ids'] ) && is_array( $cart_data['category_ids'] ) ? $cart_data['category_ids'] : array();
				return ! empty( array_intersect( $category_ids, $cart_category_ids ) );

			case 'coupon_not_applied':
				return empty( $cart_data['applied_coupons'] );

			default:
				return false;
		}
	}

	/**
	 * Compare values based on operator
	 *
	 * @param mixed  $left Left value.
	 * @param string $operator Comparison operator.
	 * @param mixed  $right Right value.
	 * @since 1.0.0
	 * @return bool
	 */
	private function compare_values( $left, $operator, $right ) {
		switch ( $operator ) {
			case 'equals':
				return $left === $right;
			case 'not_equals':
				return $left !== $right;
			case 'greater_than':
				return $left > $right;
			case 'less_than':
				return $left < $right;
			case 'greater_than_or_equal':
				return $left >= $right;
			case 'less_than_or_equal':
				return $left <= $right;
			default:
				return false;
		}
	}
}

