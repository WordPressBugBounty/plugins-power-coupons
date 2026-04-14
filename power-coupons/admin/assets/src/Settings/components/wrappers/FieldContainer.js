import { useState } from 'react';
import SectionRenderer from '../common/SectionRenderer';
import { Title } from '@bsf/force-ui';
import { useStateValue } from '../Data';
import FieldRenderer from '../common/FieldRenderer';

function sortFieldsByPriority( fields ) {
	const fieldsArray = Object.values( fields );
	if ( Array.isArray( fieldsArray ) ) {
		return [ ...fieldsArray ].sort( ( a, b ) => {
			const aPriority = typeof a.priority === 'number' ? a.priority : 0;
			const bPriority = typeof b.priority === 'number' ? b.priority : 0;
			return aPriority - bPriority;
		} );
	}
	return fieldsArray;
}

function FieldContainer( { tabKey } ) {
	const tab = powerCouponsSettings.settings_tabs?.[ tabKey ] || {};
	const title = tab?.title || tab?.name;
	const allFields = powerCouponsSettings.settings_fields?.[ tabKey ] || [];
	const [ data ] = useStateValue();

	const subtabs = tab?.subtabs || [];
	const hasSubtabs = subtabs.length > 0;
	const [ activeSubtab, setActiveSubtab ] = useState(
		hasSubtabs ? subtabs[ 0 ].slug : ''
	);

	const isGeneralTab = tabKey === 'power_coupons_general';
	const isPluginEnabled = isGeneralTab
		? data?.general?.enable_plugin ?? true
		: true;

	if ( hasSubtabs ) {
		const fields = allFields.filter( ( f ) => f.subtab === activeSubtab );

		// --- Loyalty Rewards (Points) cascading disable ---
		const isLoyaltyEnabled = data?.points_settings?.enable ?? true;
		const isRedemptionEnabled =
			data?.points_settings?.enable_redemption ?? true;
		const isExpiryEnabled = data?.points_settings?.enable_expiry ?? true;

		const redemptionSubFields = [
			'points_settings[redemption_mode]',
			'points_settings[min_points_to_redeem]',
			'points_settings[redemption_ratio]',
			'points_settings[max_discount_type]',
			'points_settings[max_discount_value]',
			'points_settings[combine_with_coupons]',
			'points_settings[max_credits_per_order]',
		];

		const expirySubFields = [
			'points_settings[expiry_days]',
			'points_settings[expiry_notice_days]',
		];

		// --- Gift Cards cascading disable ---
		const isGiftCardsEnabled = data?.gift_card_settings?.enable ?? true;

		const isFieldDisabled = ( fieldName ) => {
			// Loyalty Rewards tab fields.
			if ( fieldName.startsWith( 'points_settings[' ) ) {
				if ( fieldName === 'points_settings[enable]' ) {
					return false;
				}
				if ( ! isLoyaltyEnabled ) {
					return true;
				}
				if ( fieldName === 'points_settings[enable_redemption]' ) {
					return false;
				}
				if ( fieldName === 'points_settings[enable_expiry]' ) {
					return false;
				}
				if (
					! isRedemptionEnabled &&
					redemptionSubFields.includes( fieldName )
				) {
					return true;
				}
				if (
					! isExpiryEnabled &&
					expirySubFields.includes( fieldName )
				) {
					return true;
				}
				return false;
			}

			// Gift Cards tab fields.
			if ( fieldName.startsWith( 'gift_card_settings[' ) ) {
				if ( fieldName === 'gift_card_settings[enable]' ) {
					return false;
				}
				if ( ! isGiftCardsEnabled ) {
					return true;
				}
				return false;
			}

			return false;
		};

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

				<div className="h-auto bg-background-primary rounded-xl">
					{ /* Sub-tab buttons */ }
					<div className="flex gap-0 border-0 border-b border-solid border-border-subtle px-6">
						{ subtabs.map( ( st ) => (
							<button
								key={ st.slug }
								type="button"
								onClick={ () => setActiveSubtab( st.slug ) }
								className={ `px-3 py-3 text-sm font-medium border-0 border-b-2 border-solid transition-colors bg-transparent cursor-pointer ${
									activeSubtab === st.slug
										? 'border-b-[#f06434] text-[#f06434]'
										: 'border-b-transparent text-text-tertiary hover:text-text-primary'
								}` }
							>
								{ st.title }
							</button>
						) ) }
					</div>

					{ /* Fields */ }
					<div className="px-6">
						{ sortFieldsByPriority( fields ).map( ( field ) => (
							<FieldRenderer
								key={ field.name }
								field={ field }
								disabled={ isFieldDisabled( field.name ) }
							/>
						) ) }
					</div>
				</div>
			</>
		);
	}

	const fields = allFields;

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

			<SectionRenderer
				fields={ fields }
				masterDisabled={ ! isPluginEnabled }
				masterFieldName="general[enable_plugin]"
			/>
		</>
	);
}

export default FieldContainer;
