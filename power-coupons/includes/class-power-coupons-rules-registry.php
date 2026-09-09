<?php
/**
 * Rules Registry Class
 *
 * Centralized metadata schema and sanitization for conditional rules.
 * Handles rule groups with conditions, operators, and values.
 *
 * @package    Power_Coupons
 * @subpackage Power_Coupons/Includes
 * @since      1.0.0
 */

namespace Power_Coupons\Includes;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Power_Coupons_Rules_Registry
 *
 * Manages metadata schema for conditional rules on WooCommerce coupons.
 */
class Power_Coupons_Rules_Registry {

	/**
	 * Meta field definitions
	 *
	 * @var array<string, array<string, mixed>>
	 */
	public static $meta_fields = array(
		'_pc_rule_enable_conditions' => array(
			'default' => 'no',
			'type'    => 'checkbox',
		),
		'_pc_rule_groups'            => array(
			'default'     => array(),
			'type'        => 'array',
			'description' => 'Array of rule groups with OR logic between groups',
		),
	);

	/**
	 * Get default value for a meta field
	 *
	 * @param string $meta_key Meta key.
	 * @return mixed Default value.
	 */
	public static function get_default( $meta_key ) {
		if ( isset( self::$meta_fields[ $meta_key ]['default'] ) ) {
			return self::$meta_fields[ $meta_key ]['default'];
		}
		return '';
	}

	/**
	 * Get metadata value with default fallback
	 *
	 * @param int    $post_id    Coupon post ID.
	 * @param string $meta_key   Meta key to retrieve.
	 * @param mixed  $default    Optional. Default value if not set.
	 * @param bool   $fresh      Optional. Whether to bypass cache. Default false.
	 *
	 * @return mixed Meta value with proper type casting.
	 */
	public static function get_meta( $post_id, $meta_key, $default = null, $fresh = false ) {
		// Get field definition.
		$field = self::$meta_fields[ $meta_key ] ?? null;

		if ( ! $field ) {
			return $default;
		}

		// Use provided default or field default.
		$default_value = null !== $default ? $default : $field['default'];

		// If fresh data requested, clear cache first.
		if ( $fresh ) {
			wp_cache_delete( $post_id, 'post_meta' );
		}

		// Check if meta exists.
		if ( ! metadata_exists( 'post', $post_id, $meta_key ) ) {
			return $default_value;
		}

		$value = get_post_meta( $post_id, $meta_key, true );

		// Fallback to default if empty and default exists.
		if ( '' === $value && '' !== $default_value ) {
			return $default_value;
		}

		// Type cast based on field type.
		$field_type = is_string( $field['type'] ) ? $field['type'] : '';
		return self::cast_value( $value, $field_type );
	}

	/**
	 * Cast value to proper type
	 *
	 * @param mixed  $value Value to cast.
	 * @param string $type  Field type.
	 *
	 * @return mixed Type-casted value.
	 */
	public static function cast_value( $value, $type ) {
		switch ( $type ) {
			case 'checkbox':
			case 'text':
				return $value;

			case 'array':
				return is_array( $value ) ? $value : array();

			default:
				return $value;
		}
	}

	/**
	 * Check if rules are enabled for a coupon
	 *
	 * @param int $coupon_id Coupon ID.
	 * @return bool True if enabled, false otherwise.
	 */
	public static function are_rules_enabled( $coupon_id ) {
		$enabled = get_post_meta( $coupon_id, '_pc_rule_enable_conditions', true );
		return 'yes' === $enabled;
	}

	/**
	 * Get rule groups for a coupon
	 *
	 * @param int $coupon_id Coupon ID.
	 * @return array<int, array<string, mixed>> Array of rule groups.
	 */
	public static function get_rule_groups( $coupon_id ): array {
		$groups = get_post_meta( $coupon_id, '_pc_rule_groups', true );

		if ( empty( $groups ) || ! is_array( $groups ) ) {
			return array();
		}

		return $groups;
	}

	/**
	 * Get all rule metadata for a coupon
	 *
	 * @param int $post_id Coupon post ID.
	 *
	 * @return array<string, mixed> Associative array of all rule metadata.
	 */
	public static function get_all_meta( $post_id ) {
		return array(
			'enabled' => self::are_rules_enabled( $post_id ),
			'groups'  => self::get_rule_groups( $post_id ),
		);
	}

	/**
	 * Save multiple meta fields at once
	 *
	 * @param int                  $coupon_id Coupon ID.
	 * @param array<string, mixed> $data      Array of meta key => value pairs.
	 * @return void
	 */
	public static function save_meta( $coupon_id, $data ) {
		foreach ( $data as $meta_key => $value ) {
			if ( isset( self::$meta_fields[ $meta_key ] ) ) {
				$sanitized_value = self::sanitize_meta_value( $meta_key, $value );
				update_post_meta( $coupon_id, $meta_key, $sanitized_value );
			}
		}
	}

	/**
	 * Sanitize a meta value array data.
	 *
	 * @param array<string, mixed> $data            Array of meta key => value pairs.
	 * @return array<string, mixed> $sanitized_data Sanitized array of meta key => value pairs.
	 */
	public static function sanitize_meta_value_array_data( $data ) {
		$sanitized_data = [];
		foreach ( $data as $meta_key => $value ) {
			if ( isset( self::$meta_fields[ $meta_key ] ) ) {
				$sanitized_data[ $meta_key ] = self::sanitize_meta_value( $meta_key, $value );
			}
		}
		return $sanitized_data;
	}

	/**
	 * Sanitize a meta value based on its type
	 *
	 * @param string $meta_key Meta key.
	 * @param mixed  $value    Value to sanitize.
	 * @return mixed Sanitized value.
	 */
	private static function sanitize_meta_value( $meta_key, $value ) {
		if ( ! isset( self::$meta_fields[ $meta_key ] ) ) {
			return $value;
		}

		$field_type = self::$meta_fields[ $meta_key ]['type'];

		switch ( $field_type ) {
			case 'checkbox':
				return 'yes' === $value || true === $value ? 'yes' : 'no';

			case 'array':
				if ( '_pc_rule_groups' === $meta_key ) {
					$groups = is_array( $value ) ? $value : array();
					return self::sanitize_rule_groups( $groups );
				}
				return is_array( $value ) ? $value : array();

			default:
				return sanitize_text_field( is_string( $value ) ? $value : '' );
		}
	}

	/**
	 * Sanitize rule groups array
	 *
	 * @param array<string, mixed> $groups Rule groups array.
	 * @return array<int|string, mixed> Sanitized rule groups.
	 */
	private static function sanitize_rule_groups( $groups ) {
		if ( ! is_array( $groups ) ) {
			return array();
		}

		$sanitized_groups = array();

		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) || empty( $group['group_id'] ) ) {
				continue;
			}

			$sanitized_group = array(
				'group_id' => sanitize_text_field( $group['group_id'] ),
				'rules'    => array(),
			);

			if ( ! empty( $group['rules'] ) && is_array( $group['rules'] ) ) {
				foreach ( $group['rules'] as $rule ) {
					if ( ! is_array( $rule ) || empty( $rule['rule_id'] ) ) {
						continue;
					}

					$sanitized_rule = self::sanitize_rule( $rule );
					if ( $sanitized_rule ) {
						$sanitized_group['rules'][] = $sanitized_rule;
					}
				}
			}

			// Only add groups that have at least one rule.
			if ( ! empty( $sanitized_group['rules'] ) ) {
				$sanitized_groups[] = $sanitized_group;
			}
		}

		return $sanitized_groups;
	}

	/**
	 * Sanitize a single rule
	 *
	 * @param array<string, mixed> $rule Rule data.
	 * @return array<string, mixed>|false Sanitized rule or false if invalid.
	 */
	private static function sanitize_rule( $rule ) {
		/*
		 * Read every key through an isset() guard. The array below used to
		 * re-read $rule['rule_id'] and friends unguarded, which raises
		 * "Undefined array key" warnings on PHP 8 for any rule missing one —
		 * and a rule arriving without an operator is exactly the malformed
		 * input this method exists to clean up.
		 */
		$rule_id  = isset( $rule['rule_id'] ) && is_scalar( $rule['rule_id'] ) ? sanitize_text_field( (string) $rule['rule_id'] ) : '';
		$type     = isset( $rule['type'] ) && is_scalar( $rule['type'] ) ? sanitize_text_field( (string) $rule['type'] ) : '';
		$operator = isset( $rule['operator'] ) && is_scalar( $rule['operator'] ) ? sanitize_text_field( (string) $rule['operator'] ) : '';

		$sanitized_rule = array(
			'rule_id'  => $rule_id,
			'type'     => $type,
			'operator' => $operator,
			'value'    => '',
		);

		// Validate rule type.
		$valid_types = array( 'cart_total', 'cart_items', 'products', 'product_categories' );
		if ( ! in_array( $sanitized_rule['type'], $valid_types, true ) ) {
			return false;
		}

		$sanitized_rule['operator'] = self::normalize_operator( $sanitized_rule['type'], $sanitized_rule['operator'] );

		// Sanitize value based on rule type.
		switch ( $sanitized_rule['type'] ) {
			case 'cart_total':
				$raw_value               = isset( $rule['value'] ) ? $rule['value'] : '';
				$sanitized_rule['value'] = is_numeric( $raw_value ) ? floatval( $raw_value ) : '';
				break;

			case 'cart_items':
				$raw_value               = isset( $rule['value'] ) ? $rule['value'] : '';
				$sanitized_rule['value'] = is_numeric( $raw_value ) ? absint( $raw_value ) : '';
				break;

			case 'products':
			case 'product_categories':
				/*
				 * The rule editor is a single select, so this is normally one ID
				 * and is stored as one. A list is preserved rather than thrown
				 * away, because imported and legacy rules hold one and silently
				 * flattening it to '' turns a configured restriction into no
				 * restriction at all. Frontend_Rules accepts both shapes.
				 */
				$raw_value               = isset( $rule['value'] ) ? $rule['value'] : '';
				$sanitized_rule['value'] = self::sanitize_id_value( $raw_value );
				break;
		}

		return $sanitized_rule;
	}

	/**
	 * Coerce a rule's operator into one that is valid for its type.
	 *
	 * The rule editor resets the operator whenever the type changes, so nothing
	 * that ships produces a mismatch. Stored meta can still hold one — from an
	 * import, a crafted request, or an older version — and since
	 * `Utilities::compare_numeric()` and the list validators now fail *closed*,
	 * an operator that no branch understands would silently and permanently
	 * stop the coupon from ever applying.
	 *
	 * So repair the cases that map *confidently* — case and whitespace
	 * differences, which are the likeliest import artefacts, and the legacy
	 * alias names — and leave anything still unrecognised exactly as it is.
	 *
	 * Deliberately no fallback to "the first valid operator for this type".
	 * The list types have exactly two operators that mean opposite things, so
	 * that fallback silently rewrites `NOT_IN_LIST` — a case difference — into
	 * `in_list`, turning *exclude product 42* into *require product 42* and
	 * persisting the inverse of the merchant's intent. Granting a discount that
	 * should have been blocked is a worse and much quieter failure than the
	 * fail-closed-plus-log behaviour it would replace, so an operator we cannot
	 * confidently map is left for the runtime to reject and log.
	 *
	 * @since 1.0.7
	 * @param string $type     Rule type, already validated by the caller.
	 * @param string $operator Raw operator from the request or stored meta.
	 * @return string A valid operator where one can be derived, else $operator unchanged.
	 */
	private static function normalize_operator( $type, $operator ) {
		$candidate = strtolower( trim( $operator ) );

		$legacy_aliases = array(
			'equals'     => 'equal_to',
			'not_equals' => 'not_equal_to',
		);

		if ( isset( $legacy_aliases[ $candidate ] ) ) {
			$candidate = $legacy_aliases[ $candidate ];
		}

		if ( self::is_valid_operator( $type, $candidate ) ) {
			return $candidate;
		}

		return $operator;
	}

	/**
	 * Sanitize a product or category rule value.
	 *
	 * Keeps the stored shape the same as the shape that came in: a single ID
	 * stays a single ID, a list stays a list. Anything that is not a positive
	 * ID is dropped, and a value with nothing usable left becomes '' — the
	 * "not configured yet" marker the validators treat as "no restriction".
	 *
	 * Cast with `(int)`, never `absint()`, for the same reason as
	 * `Frontend_Rules::normalize_id_list()`: `absint( -3 )` is `3`, so a
	 * malformed value would be stored as a restriction on a different, real
	 * product rather than discarded.
	 *
	 * @param mixed $raw_value Raw value from the request or from stored meta.
	 * @return int|string|array<int, int> Sanitized value.
	 */
	private static function sanitize_id_value( $raw_value ) {
		if ( is_array( $raw_value ) ) {
			$ids = array();
			foreach ( $raw_value as $candidate ) {
				if ( is_scalar( $candidate ) && is_numeric( $candidate ) && (int) $candidate > 0 ) {
					$ids[] = (int) $candidate;
				}
			}

			return empty( $ids ) ? '' : array_values( array_unique( $ids ) );
		}

		if ( ! is_numeric( $raw_value ) || (int) $raw_value <= 0 ) {
			return '';
		}

		return (int) $raw_value;
	}

	/**
	 * Validate operator for a given rule type
	 *
	 * @param string $type     Rule type.
	 * @param string $operator Operator to validate.
	 * @return bool True if valid, false otherwise.
	 */
	public static function is_valid_operator( $type, $operator ) {
		$operators = self::get_operators_for_type( $type );
		return in_array( $operator, $operators, true );
	}

	/**
	 * Get valid operators for a rule type
	 *
	 * @param string $type Rule type.
	 * @return array<int, string> Array of valid operators.
	 */
	public static function get_operators_for_type( $type ) {
		$operators_map = array(
			'cart_total'         => array( 'equal_to', 'not_equal_to', 'less_than', 'less_than_or_equal', 'greater_than', 'greater_than_or_equal' ),
			'cart_items'         => array( 'equal_to', 'not_equal_to', 'less_than', 'less_than_or_equal', 'greater_than', 'greater_than_or_equal' ),
			'products'           => array( 'in_list', 'not_in_list' ),
			'product_categories' => array( 'in_list', 'not_in_list' ),
		);

		return isset( $operators_map[ $type ] ) ? $operators_map[ $type ] : array();
	}

	/**
	 * Get all meta fields
	 *
	 * @return array<string, mixed> Meta fields.
	 */
	public static function get_all_fields() {
		return self::$meta_fields;
	}
}
