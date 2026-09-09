<?php
/**
 * Power Coupons NPS Survey Loader.
 *
 * Loads the shared brainstormforce/nps-survey library using the standard
 * "highest bundled version wins" pattern: every BSF plugin registers its
 * bundled copy via version_check(); the newest one across all active plugins
 * is the one that actually loads.
 *
 * @package Power_Coupons
 * @since x.x.x
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Power_Coupons_Nps_Survey' ) ) :

	/**
	 * Power Coupons Nps Survey Loader
	 *
	 * @since x.x.x
	 */
	class Power_Coupons_Nps_Survey {
		/**
		 * Instance
		 *
		 * @since x.x.x
		 * @var (Object) Power_Coupons_Nps_Survey
		 */
		private static $instance = null;

		/**
		 * Get Instance
		 *
		 * @since x.x.x
		 *
		 * @return object Class object.
		 */
		public static function get_instance() {
			if ( ! isset( self::$instance ) ) {
				self::$instance = new self();
			}

			return self::$instance;
		}

		/**
		 * Constructor.
		 *
		 * @since x.x.x
		 */
		private function __construct() {
			$this->version_check();
			add_action( 'init', array( $this, 'load' ), 999 );
			add_filter( 'nps_survey_api_endpoint', array( $this, 'update_webhook_url' ), 10, 2 );
			add_filter( 'nps_survey_post_data', array( $this, 'mark_nps_dismissed_on_submit' ), 10, 1 );
		}

		/**
		 * Version Check
		 *
		 * @since x.x.x
		 * @return void
		 */
		public function version_check() {

			$file = realpath( dirname( __FILE__ ) . '/nps-survey/version.json' );

			// Is file exist?
			if ( is_file( $file ) ) {

				$file_data = json_decode( file_get_contents( $file ), true );

				global $nps_survey_version, $nps_survey_init;

				$path = realpath( dirname( __FILE__ ) . '/nps-survey/nps-survey.php' );

				$version = isset( $file_data['nps-survey'] ) ? $file_data['nps-survey'] : 0;

				if ( null === $nps_survey_version ) {
					$nps_survey_version = '1.0.0';
				}

				// Compare versions.
				if ( version_compare( $version, $nps_survey_version, '>=' ) ) {
					$nps_survey_version = $version;
					$nps_survey_init    = $path;
				}
			}
		}

		/**
		 * Load latest plugin
		 *
		 * @since x.x.x
		 * @return void
		 */
		public function load() {

			global $nps_survey_version, $nps_survey_init;
			if ( is_file( realpath( $nps_survey_init ) ) ) {
				include_once realpath( $nps_survey_init );
			}
		}

		/**
		 * Update the NPS survey webhook URL.
		 *
		 * @param string       $url Webhook URL.
		 * @param array<mixed> $post_data NPS survey post data.
		 *
		 * @return string
		 */
		public function update_webhook_url( $url, $post_data ) {
			if ( isset( $post_data['plugin_slug'] ) && 'power-coupons' === $post_data['plugin_slug'] ) {
				// Return the NPS webhook URL if the plugin slug is Power Coupons.
				return POWER_COUPONS_NPS_WEBHOOK_URL;
			}

			return $url;
		}

		/**
		 * Lock the NPS dismissal state as soon as a submission is initiated.
		 * The bundled library only persists `dismiss_permanently` on an HTTP 200
		 * response from the webhook. Ottokit can return 202/204, leaving the
		 * notice re-displayable and causing the same user to resubmit repeatedly.
		 *
		 * @param array<mixed> $post_data NPS survey post data.
		 * @return array<mixed>
		 */
		public function mark_nps_dismissed_on_submit( $post_data ) {
			if ( ! isset( $post_data['plugin_slug'] ) || 'power-coupons' !== $post_data['plugin_slug'] ) {
				return $post_data;
			}

			update_option(
				'nps-survey-power-coupons',
				array(
					'dismiss_count'       => 0,
					'dismiss_permanently' => true,
					'dismiss_step'        => 'submitted',
				),
				false
			);

			return $post_data;
		}

	}

	/**
	 * Kicking this off by calling 'get_instance()' method
	 */
	Power_Coupons_Nps_Survey::get_instance();

endif;
