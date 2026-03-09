import SectionRenderer from '../common/SectionRenderer';
import { Title } from '@bsf/force-ui';
import React from 'react';

function FieldContainer( { tabKey } ) {
	const tab = powerCouponsSettings.settings_tabs?.[ tabKey ] || {};
	const title = tab?.title || tab?.name;
	const fields = powerCouponsSettings.settings_fields?.[ tabKey ] || [];

	return (
		<>
			<Title
				description=""
				icon={ null }
				size="md"
				tag="h2"
				title={ title }
				className="mb-6 [&_h2]:text-gray-900 text-xl"
			/>

			<SectionRenderer fields={ fields } />
		</>
	);
}

export default FieldContainer;
