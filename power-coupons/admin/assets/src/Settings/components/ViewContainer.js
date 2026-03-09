import { Container, Toaster, toast } from '@bsf/force-ui';
import React, { useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

import { useStateValue } from './Data';
import Header from './Header';
import Settings from './path/Settings';
import apiFetch from '@wordpress/api-fetch';

function ViewContainer() {
	const [ data ] = useStateValue();
	const [ settingsTab, setSettingsTab ] = useState( '' );
	const query = new URLSearchParams( useLocation().search );
	const activePage = 'power_coupons_settings';
	const activePath = query.get( 'path' ) || 'settings';

	const [ processing, setProcessing ] = useState( false );
	const updateData = useRef( false );

	useEffect( () => {
		if ( ! updateData.current ) {
			updateData.current = true;
			return;
		}

		const formData = new window.FormData();
		formData.append( 'action', 'power_coupons_update_settings' );
		formData.append( 'security', window.powerCouponsSettings.update_nonce );
		formData.append( 'power_coupons_settings', JSON.stringify( data ) );

		setProcessing( true );

		apiFetch( {
			url: window.powerCouponsSettings.ajax_url,
			method: 'POST',
			body: formData,
		} ).then( () => {
			setProcessing( false );
			toast.success( 'Successfully Saved!', {
				description: '',
			} );
		} );
	}, [ data ] );

	const history = useHistory();
	const navigation = [];

	const settingsTabs = window.powerCouponsSettings.settings_tabs
		? Object.values( window.powerCouponsSettings.settings_tabs )
		: [];

	Object.values( settingsTabs )
		.sort( ( a, b ) => ( a.priority || 0 ) - ( b.priority || 0 ) )
		.forEach( ( tab ) => {
			navigation.push( {
				name: tab.label || tab.name,
				slug: tab.slug,
			} );
		} );

	const settingsTabSlugs = settingsTabs.map( ( tab ) => tab.slug );
	const tab = settingsTabSlugs.includes( query.get( 'tab' ) )
		? query.get( 'tab' )
		: getSettingsTab();

	function navigate( navigateTab ) {
		setSettingsTab( navigateTab );
		history.push(
			'admin.php?page=power_coupons_settings&path=settings&tab=' +
				navigateTab
		);
	}

	function getSettingsTab() {
		return settingsTab || 'power_coupons_general';
	}

	return (
		<form
			className="powerCouponsSettings"
			id="powerCouponsSettings"
			method="post"
		>
			<Container
				className="h-full"
				containerType="flex"
				direction="column"
				gap={ 0 }
			>
				<Container.Item>
					<Header
						processing={ processing }
						activePage={ activePage }
						activePath={ activePath }
					/>
				</Container.Item>
				{ 'settings' === activePath && (
					<Container.Item className="flex gap-4 bg-background-secondary max-h-[calc(100%_-_6rem)]">
						<Toaster
							position="top-right"
							design="stack"
							theme="light"
							autoDismiss={ true }
							dismissAfter={ 2000 }
							className="top-16"
						/>
						<Settings
							navigation={ navigation }
							tab={ tab }
							navigate={ navigate }
						/>
					</Container.Item>
				) }
			</Container>
		</form>
	);
}

export default ViewContainer;
