import { __ } from '@wordpress/i18n';
import { Badge } from '@bsf/force-ui';
import { useStateValue } from '../Data';

function LoyaltyStatusPill() {
	const [ data ] = useStateValue();
	const isEnabled = !! data?.points_settings?.enable;

	return (
		<Badge
			size="xs"
			type="pill"
			variant={ isEnabled ? 'green' : 'yellow' }
			disableHover
			label={
				isEnabled
					? __( 'Active', 'power-coupons' )
					: __( 'Disabled', 'power-coupons' )
			}
			icon={
				<span
					aria-hidden="true"
					className={ `inline-block size-1.5 rounded-full ${
						isEnabled ? 'bg-support-success' : 'bg-support-warning'
					}` }
				/>
			}
			aria-label={
				isEnabled
					? __( 'Loyalty Rewards is enabled', 'power-coupons' )
					: __( 'Loyalty Rewards is disabled', 'power-coupons' )
			}
		/>
	);
}

export default LoyaltyStatusPill;
