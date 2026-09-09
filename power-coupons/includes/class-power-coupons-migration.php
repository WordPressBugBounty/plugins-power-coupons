<?php
/**
 * Plugin Migrations
 *
 * Handles silent data migrations on plugin update or activation.
 *
 * @package Power_Coupons
 * @since 1.0.3
 */

namespace Power_Coupons\Includes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Power_Coupons_Migration
 */
class Power_Coupons_Migration {

	/**
	 * Option key to track the last completed migration version.
	 *
	 * @var string
	 */
	const DB_VERSION_KEY = 'power_coupons_db_version';

	/**
	 * Target schema version for the migrations in this class.
	 *
	 * @var string
	 */
	const TARGET_VERSION = '1.0.3';

	/**
	 * Register the entry points that can run pending migrations.
	 *
	 * Admin page loads are the common path, but they are not the only way a site
	 * gets updated. A store managed with WP-CLI, or one where nobody signs in to
	 * wp-admin after an update, would otherwise stay un-migrated indefinitely —
	 * and for the slideout migration that means coupons silently missing from the
	 * drawer. WP-CLI and cron get their own entry point on `init` for that reason.
	 *
	 * Deliberately not hooked on plain front-end requests: migrations write, and
	 * concurrent public traffic is the one context where two of them could
	 * overlap. CLI is single-process and cron is already serialised by WordPress.
	 *
	 * @since 1.0.7
	 * @return void
	 */
	public static function register() {
		if ( defined( 'WP_CLI' ) && WP_CLI && class_exists( '\WP_CLI' ) ) {
			\WP_CLI::add_command( 'power-coupons migrate', array( __CLASS__, 'cli_migrate' ) );
		}

		if ( is_admin() ) {
			add_action( 'admin_init', array( __CLASS__, 'run' ) );
			return;
		}

		if ( ( defined( 'WP_CLI' ) && WP_CLI ) || wp_doing_cron() ) {
			add_action( 'init', array( __CLASS__, 'run' ), 20 );
		}
	}

	/**
	 * WP-CLI: run any pending Power Coupons data migrations.
	 *
	 * Migrations are version-gated and idempotent, so running this on an
	 * already-migrated site is a no-op.
	 *
	 * ## OPTIONS
	 *
	 * [--force]
	 * : Re-run the migrations even if they are already marked complete.
	 *
	 * ## EXAMPLES
	 *
	 *     wp power-coupons migrate
	 *     wp power-coupons migrate --force
	 *
	 * @param array<int, string>    $args       Positional arguments (unused).
	 * @param array<string, string> $assoc_args Associative arguments.
	 * @return void
	 */
	public static function cli_migrate( $args, $assoc_args ) {
		$forced = isset( $assoc_args['force'] );

		if ( $forced ) {
			delete_option( 'power_coupons_migrated_slideout_visibility' );
			self::run_on_activation();
		} else {
			// Usually a no-op: the `init` hook registered for WP-CLI has already
			// run by now. self::$did_run records whether that pass migrated.
			self::run();
		}

		$version = get_option( self::DB_VERSION_KEY, '0' );
		$version = is_string( $version ) ? $version : '0';

		if ( ! $forced && ! self::$did_run ) {
			\WP_CLI::success( sprintf( 'No pending migrations. Schema is at %s.', $version ) );
			return;
		}

		\WP_CLI::success( sprintf( 'Migrations complete. Schema is at %s.', $version ) );
	}

	/**
	 * Whether run() actually performed a migration in this request.
	 *
	 * `register()` hooks `run()` on `init` under WP-CLI, so by the time a CLI
	 * command callback executes the work is already done and the schema version
	 * already current. Without this the command could only report "nothing to
	 * do", even on the very invocation that migrated.
	 *
	 * @since 1.0.7
	 * @var bool
	 */
	private static $did_run = false;

	/**
	 * Run pending migrations (version-gated).
	 *
	 * @return void
	 */
	public static function run() {
		$db_version = get_option( self::DB_VERSION_KEY, '0' );
		$db_version = is_string( $db_version ) ? $db_version : '0';

		if ( version_compare( $db_version, self::TARGET_VERSION, '<' ) ) {
			self::migrate_slideout_visibility();
			update_option( self::DB_VERSION_KEY, self::TARGET_VERSION );
			self::$did_run = true;
		}
	}

	/**
	 * Run all migrations on plugin activation.
	 *
	 * Bypasses the version check so migrations run even when the plugin is
	 * deactivated/reactivated at the same version (e.g. during development
	 * or when a new build is uploaded without a version bump).
	 *
	 * Each individual migration is idempotent — it uses a dedicated completion
	 * flag so repeated runs are safe.
	 *
	 * @return void
	 */
	public static function run_on_activation() {
		self::migrate_slideout_visibility();
		update_option( self::DB_VERSION_KEY, self::TARGET_VERSION );
	}

	/**
	 * Migrate from "Hide from slideout" (opt-out) to "Show in slideout" (opt-in).
	 *
	 * For existing installs, converts old behaviour where all coupons were visible
	 * by default. After migration, only coupons with `_power_coupon_show_in_slideout`
	 * = 'yes' appear in the slideout.
	 *
	 * Migration logic:
	 *  - Coupons with old hide meta = 'yes' → stay hidden (no new meta).
	 *  - All other existing coupons → show_in_slideout = 'yes' (preserve visibility).
	 *  - Old `_power_coupon_hide_in_slideout` meta is cleaned up.
	 *
	 * Skips on fresh installs (no `power_coupons_settings` option = never configured).
	 * Idempotent via a dedicated completion flag.
	 *
	 * @return void
	 */
	private static function migrate_slideout_visibility() {
		// Check if this migration has already been completed.
		if ( 'done' === get_option( 'power_coupons_migrated_slideout_visibility' ) ) {
			return;
		}

		// Only migrate for existing installs — fresh installs should default to hidden.
		if ( false === get_option( 'power_coupons_settings' ) ) {
			update_option( 'power_coupons_migrated_slideout_visibility', 'done' );
			return;
		}

		global $wpdb;

		// Get IDs of coupons that were explicitly hidden with the old meta.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$hidden_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = %s",
				'_power_coupon_hide_in_slideout',
				'yes'
			)
		);

		// Get all published/draft coupon IDs.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$all_coupon_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts} WHERE post_type = %s AND post_status IN ('publish', 'draft', 'pending', 'private')",
				'shop_coupon'
			)
		);

		if ( ! empty( $all_coupon_ids ) ) {
			// Coupons that were visible = all coupons minus the hidden ones.
			$visible_ids = array_diff( $all_coupon_ids, $hidden_ids );

			// Set show_in_slideout = 'yes' for previously visible coupons,
			// but skip any that already have the new meta (idempotency).
			foreach ( $visible_ids as $coupon_id ) {
				$existing = get_post_meta( (int) $coupon_id, '_power_coupon_show_in_slideout', true );
				if ( '' === $existing ) {
					update_post_meta( (int) $coupon_id, '_power_coupon_show_in_slideout', 'yes' );
				}
			}
		}

		/*
		 * Mark the migration done BEFORE dropping the old meta.
		 *
		 * The old meta is the only record of which coupons were hidden. If the
		 * request dies between the delete and the flag, the next run reads an
		 * empty `$hidden_ids` and marks every coupon visible — the previously
		 * hidden ones included. Writing the flag first makes the worst case a
		 * few rows of dead meta instead of coupons reappearing in the drawer.
		 */
		update_option( 'power_coupons_migrated_slideout_visibility', 'done' );

		/*
		 * Clean up old meta key from coupons only.
		 *
		 * `$wpdb->delete()` can only match on the meta key, which would take the
		 * row out of every post type that happens to carry it. Nothing else
		 * writes this key today, but a store-wide delete is not ours to make —
		 * join through `posts` so the migration stays inside `shop_coupon`.
		 */
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query(
			$wpdb->prepare(
				"DELETE pm FROM {$wpdb->postmeta} pm
				 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				 WHERE pm.meta_key = %s AND p.post_type = %s",
				'_power_coupon_hide_in_slideout',
				'shop_coupon'
			)
		);
	}
}
