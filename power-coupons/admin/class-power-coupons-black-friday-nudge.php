<?php
/**
 * Power Coupons Black Friday 2026 dashboard nudge.
 *
 * Adds a dismissible deal bar to the top of the WordPress Dashboard that
 * links to the Power Coupons pricing page and stops showing after 5 December 2026.
 *
 * @package Power_Coupons
 * @since x.x.x
 */

namespace Power_Coupons\Admin;

use Power_Coupons\Includes\Traits\Power_Coupons_Singleton;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Power_Coupons_Black_Friday_Nudge.
 *
 * @since x.x.x
 */
class Power_Coupons_Black_Friday_Nudge {

	use Power_Coupons_Singleton;

	/**
	 * Local date-time (site timezone) the bar stops showing: it shows through 5 December 2026.
	 *
	 * @var string
	 */
	const END_DATE = '2026-12-06 00:00:00';

	/**
	 * User meta holding the time the current user dismissed the bar.
	 *
	 * @var string
	 */
	const DISMISS_META = 'power_coupons_bf_2026_bar_dismissed';

	/**
	 * AJAX action (and nonce action) that dismisses the bar.
	 *
	 * @var string
	 */
	const AJAX_ACTION = 'power_coupons_dismiss_bf_nudge';

	/**
	 * Shared filter that CartFlows, Cart Abandonment Recovery, Modern Cart and Power Coupons each add
	 * themselves to while their bar applies. Only the highest-priority plugin in the list shows a bar.
	 *
	 * @var string
	 */
	const BAR_CANDIDATES_FILTER = 'bsf_bf_2026_dashboard_bar_candidates';

	/**
	 * This plugin's key in the shared candidates list.
	 *
	 * @var string
	 */
	const BAR_SLUG = 'power-coupons';

	/**
	 * Priority in the shared candidates list, lowest wins: CartFlows 10, Cart Abandonment Recovery 20,
	 * Modern Cart 30, Power Coupons 40.
	 *
	 * @var int
	 */
	const BAR_PRIORITY = 40;

	/**
	 * Constructor.
	 *
	 * @since x.x.x
	 */
	protected function __construct() {
		// After the admin bar (priority 0), before the Screen Options tabs and admin notices.
		add_action( 'in_admin_header', array( $this, 'render_bar' ), 20 );
		add_action( 'wp_ajax_' . self::AJAX_ACTION, array( $this, 'dismiss' ) );
		add_filter( self::BAR_CANDIDATES_FILTER, array( $this, 'add_bar_candidate' ) );
	}

	/**
	 * Whether the Black Friday sale is still running.
	 *
	 * @since x.x.x
	 * @return bool
	 */
	public function is_sale_running() {

		$end = new \DateTimeImmutable( self::END_DATE, wp_timezone() );

		/**
		 * Filters the Unix time the Black Friday bar stops showing.
		 *
		 * @since x.x.x
		 * @param int $end_timestamp Unix timestamp. Defaults to the start of 6 December 2026 in the site timezone.
		 */
		$end_timestamp = (int) apply_filters( 'power_coupons_bf_nudge_end_timestamp', $end->getTimestamp() );

		return time() < $end_timestamp;
	}

	/**
	 * Whether the current user is in the audience for the bar, ignoring dismissals:
	 * administrators without Power Coupons Pro, while the sale is running.
	 *
	 * @since x.x.x
	 * @return bool
	 */
	public function is_audience() {

		if ( ! $this->is_sale_running() || ! current_user_can( 'manage_options' ) ) {
			return false;
		}

		return ! defined( 'POWER_COUPONS_PRO_VERSION' );
	}

	/**
	 * Whether the current user dismissed the bar.
	 *
	 * @since x.x.x
	 * @return bool
	 */
	public function is_dismissed() {
		return ! empty( get_user_meta( get_current_user_id(), self::DISMISS_META, true ) );
	}

	/**
	 * Add this plugin to the shared list of plugins that could show a Black Friday bar.
	 *
	 * @since x.x.x
	 * @param mixed $candidates Candidates keyed by plugin slug, each with a priority and a dismissed flag.
	 * @return array<string, array{priority: int, dismissed: bool}>
	 */
	public function add_bar_candidate( $candidates ) {

		$candidates = is_array( $candidates ) ? $candidates : array();

		if ( $this->is_audience() ) {
			$candidates[ self::BAR_SLUG ] = array(
				'priority'  => self::BAR_PRIORITY,
				'dismissed' => $this->is_dismissed(),
			);
		}

		return $candidates;
	}

	/**
	 * Whether this plugin's bar shows: it has the highest priority among the plugins whose bar applies,
	 * and the user has not dismissed it. The winner keeps the slot after a dismissal, so no other bar replaces it.
	 *
	 * @since x.x.x
	 * @return bool
	 */
	public function should_render_bar() {

		$candidates = apply_filters( self::BAR_CANDIDATES_FILTER, array() );

		if ( ! is_array( $candidates ) || empty( $candidates[ self::BAR_SLUG ] ) ) {
			return false;
		}

		$winner        = '';
		$best_priority = PHP_INT_MAX;

		foreach ( $candidates as $slug => $candidate ) {
			$priority = is_array( $candidate ) && isset( $candidate['priority'] ) ? (int) $candidate['priority'] : PHP_INT_MAX;

			// Ties go to the alphabetically first slug so every plugin picks the same winner.
			if ( $priority < $best_priority || ( $priority === $best_priority && strcmp( (string) $slug, $winner ) < 0 ) ) {
				$best_priority = $priority;
				$winner        = (string) $slug;
			}
		}

		return self::BAR_SLUG === $winner && empty( $candidates[ self::BAR_SLUG ]['dismissed'] );
	}

	/**
	 * Render the deal bar at the top of the WordPress Dashboard.
	 *
	 * @since x.x.x
	 * @return void
	 */
	public function render_bar() {

		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;

		if ( ! $screen || 'dashboard' !== $screen->id ) {
			return;
		}

		// One bar per site: only the highest-priority plugin among CartFlows, Cart Abandonment Recovery, Modern Cart and Power Coupons shows it.
		if ( ! $this->should_render_bar() ) {
			return;
		}

		$message = sprintf(
			/* translators: 1: opening strong tag, 2: closing strong tag, 3: product name, 4: discount, e.g. "56% OFF". */
			__( '%1$sBlack Friday Deal:%2$s Get %3$s for up to %4$s before it’s gone.', 'power-coupons' ),
			'<strong>',
			'</strong>',
			'<strong>Power Coupons Pro</strong>',
			'<span class="power-coupons-bf-off">' . esc_html__( '56% OFF', 'power-coupons' ) . '</span>'
		);

		$this->print_assets();
		?>
		<div class="power-coupons-bf-bar" data-nonce="<?php echo esc_attr( wp_create_nonce( self::AJAX_ACTION ) ); ?>">
			<p class="power-coupons-bf-bar__text">
				<?php
				// Each 🔥 carries a non-breaking space in a nowrap span, so it never wraps onto a line of its own.
				echo wp_kses(
					'<span class="power-coupons-bf-emoji" aria-hidden="true">🔥&nbsp;</span>' . $message . '<span class="power-coupons-bf-emoji" aria-hidden="true">&nbsp;🔥</span>',
					array(
						'strong' => array(),
						'span'   => array(
							'class'       => array(),
							'aria-hidden' => array(),
						),
					)
				);
				?>
			</p>
			<a class="power-coupons-bf-cta" href="<?php echo esc_url( 'https://cartflows.com/power-coupons-for-woocommerce/pricing/?utm_source=dashboard&utm_medium=free-power-coupons&utm_campaign=bfcm' ); ?>" target="_blank" rel="noopener noreferrer">
				<?php esc_html_e( 'Claim Lifetime Deal', 'power-coupons' ); ?>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
			</a>
			<button type="button" class="power-coupons-bf-close" aria-label="<?php esc_attr_e( 'Dismiss this Black Friday offer', 'power-coupons' ); ?>">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M3 3l10 10M13 3L3 13"/></svg>
			</button>
		</div>
		<?php
	}

	/**
	 * AJAX handler: hide the bar for the current user.
	 *
	 * @since x.x.x
	 * @return void
	 */
	public function dismiss() {

		check_ajax_referer( self::AJAX_ACTION, 'security' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'You are not allowed to do this.', 'power-coupons' ) ), 403 );
		}

		update_user_meta( get_current_user_id(), self::DISMISS_META, time() );

		wp_send_json_success();
	}

	/**
	 * Print the bar styles and the dismiss script.
	 *
	 * @since x.x.x
	 * @return void
	 */
	private function print_assets() {

		$config = array(
			'ajaxUrl' => admin_url( 'admin-ajax.php' ),
			'action'  => self::AJAX_ACTION,
		);
		?>
		<style>
			.power-coupons-bf-bar { position: relative; display: flex; align-items: center; justify-content: center; gap: 14px; margin-inline-start: -20px; padding: 10px 52px; overflow: hidden; background: #fcf1ec; border-bottom: 1px solid #f7dccf; color: #3c434a; }
			.power-coupons-bf-bar::before, .power-coupons-bf-bar::after { content: ""; position: absolute; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(240, 99, 53, .13) 0%, rgba(240, 99, 53, 0) 70%); pointer-events: none; }
			.power-coupons-bf-bar::before { left: -70px; top: -110px; }
			.power-coupons-bf-bar::after { right: -50px; bottom: -120px; }
			.power-coupons-bf-bar__text { position: relative; margin: 0; font-size: 14px; line-height: 1.5; color: #3c434a; }
			.power-coupons-bf-bar__text strong { color: #1d2327; font-weight: 600; }
			.power-coupons-bf-off { color: #f06335; font-weight: 700; }
			.power-coupons-bf-emoji { white-space: nowrap; }
			.power-coupons-bf-cta { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 4px; background: #f06335; box-shadow: 0 1px 2px rgba(217, 80, 31, .25); color: #fff; font-size: 13px; font-weight: 600; line-height: 1.4; text-decoration: none; white-space: nowrap; transition: background .15s ease, box-shadow .15s ease; }
			.power-coupons-bf-cta:hover, .power-coupons-bf-cta:focus { background: #d9501f; box-shadow: 0 3px 8px rgba(217, 80, 31, .3); color: #fff; }
			.power-coupons-bf-cta:focus-visible { outline: 2px solid #1d2327; outline-offset: 2px; }
			.power-coupons-bf-cta svg { flex: 0 0 auto; transition: transform .15s ease; }
			.power-coupons-bf-cta:hover svg { transform: translateX(2px); }
			.power-coupons-bf-close { position: absolute; inset-inline-end: 12px; top: 50%; transform: translateY(-50%); margin: 0; padding: 6px; border: 0; border-radius: 4px; background: none; color: #8c8f94; line-height: 0; cursor: pointer; }
			.power-coupons-bf-close:hover, .power-coupons-bf-close:focus { background: rgba(0, 0, 0, .05); color: #1d2327; }
			.power-coupons-bf-close:focus-visible { outline: 2px solid #1d2327; outline-offset: 1px; }
			@media screen and (max-width: 960px) {
				.power-coupons-bf-bar { flex-wrap: wrap; gap: 10px; padding: 12px 40px; text-align: center; }
				.power-coupons-bf-bar__text { flex-basis: 100%; }
				.power-coupons-bf-close { top: 8px; transform: none; }
			}
			@media screen and (max-width: 782px) {
				.power-coupons-bf-bar { margin-inline-start: -10px; }
			}
			/* Below 600px core clears the admin bar with #wpbody padding, so shift the bar into that space. */
			@media screen and (max-width: 600px) {
				.power-coupons-bf-bar { top: 46px; }
			}
		</style>
		<script>
			( function ( config ) {
				document.addEventListener( 'click', function ( event ) {
					var button = event.target && event.target.closest ? event.target.closest( '.power-coupons-bf-close' ) : null;
					var bar = button ? button.closest( '.power-coupons-bf-bar' ) : null;

					if ( ! bar ) {
						return;
					}

					var data = new window.FormData();
					data.append( 'action', config.action );
					data.append( 'security', bar.getAttribute( 'data-nonce' ) );

					// Hide it right away, and bring it back if the dismissal is not saved so the user can try again.
					var restore = function () {
						bar.style.display = '';
					};

					bar.style.display = 'none';

					window.fetch( config.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: data } )
						.then( function ( response ) {
							return response.ok ? response.json() : null;
						} )
						.then( function ( result ) {
							if ( ! result || ! result.success ) {
								restore();
							}
						} )
						.catch( restore );
				} );
			} )( <?php echo wp_json_encode( $config ); ?> );
		</script>
		<?php
	}
}
