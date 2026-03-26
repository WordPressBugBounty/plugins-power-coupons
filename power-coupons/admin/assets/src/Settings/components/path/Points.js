import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import { Tabs } from '@bsf/force-ui';
import CampaignsList from '../points/CampaignsList';
import PointsHistory from '../points/PointsHistory';

const TABS = [
	{ slug: 'campaigns', title: __( 'Reward Campaigns', 'power-coupons' ) },
	{ slug: 'history', title: __( 'Logs', 'power-coupons' ) },
];

function Points( { toast } ) {
	const [ activeTab, setActiveTab ] = useState( 'campaigns' );

	const tabSelector = (
		<Tabs activeItem={ activeTab }>
			<Tabs.Group
				className="pc-tabs-rounded"
				orientation="horizontal"
				size="md"
				variant="rounded"
				width="auto"
			>
				{ TABS.map( ( tab ) => (
					<Tabs.Tab
						key={ tab.slug }
						slug={ tab.slug }
						text={ tab.title }
						type="button"
						onClick={ () => setActiveTab( tab.slug ) }
					/>
				) ) }
			</Tabs.Group>
		</Tabs>
	);

	return (
		<div className="flex flex-col gap-4">
			{ 'campaigns' === activeTab && (
				<CampaignsList toast={ toast } tabSelector={ tabSelector } />
			) }
			{ 'history' === activeTab && (
				<PointsHistory toast={ toast } tabSelector={ tabSelector } />
			) }
		</div>
	);
}

export default Points;
