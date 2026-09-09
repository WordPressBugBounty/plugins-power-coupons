import { Badge, Tooltip } from '@bsf/force-ui';
import { useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Plugin version badges for the admin topbar.
 *
 * The core version always shows. The PRO version joins it, behind a divider,
 * whenever the PRO plugin is active — it puts `pro_version` on the localized
 * settings through `power_coupons_filter_admin_localize_data`.
 */
const VersionBadge = () => {
	const { version, pro_version: proVersion } = powerCouponsSettings;

	// Tailwind scopes every utility under `#power-coupons-settings`, so a
	// tooltip left in Floating UI's default portal on <body> lands outside that
	// scope and renders with no background, no colour and no z-index — present
	// in the DOM, invisible on screen. Portal it back inside the app root, the
	// same way the BOGO screen does.
	const portalRootRef = useRef(
		document.getElementById( 'power-coupons-settings' )
	);

	const coreBadge = (
		<Tooltip
			content={ __( 'Core', 'power-coupons' ) }
			placement="bottom"
			arrow
			className="z-[99999]"
			tooltipPortalRoot={ portalRootRef.current }
		>
			<Badge
				label={ `V ${ version }` }
				size="xs"
				variant="neutral"
				disableHover
			/>
		</Tooltip>
	);

	if ( ! proVersion ) {
		return coreBadge;
	}

	return (
		<>
			{ coreBadge }
			<hr className="w-px h-4 border-l border-r-0 border-y-0 border-solid border-border-subtle" />
			<Tooltip
				content={ __( 'Power Coupons Pro', 'power-coupons' ) }
				placement="bottom"
				arrow
				className="z-[99999]"
				tooltipPortalRoot={ portalRootRef.current }
			>
				<Badge
					label={ `V ${ proVersion }` }
					size="xs"
					variant="inverse"
					disableHover
				/>
			</Tooltip>
		</>
	);
};

export default VersionBadge;
