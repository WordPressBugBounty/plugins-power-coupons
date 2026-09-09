import { __, sprintf } from '@wordpress/i18n';
import { useStateValue } from '../Data';
import FieldWrapper from '../wrappers/FieldWrapper';
import { OptionTile } from '../onboarding/Components';
import safeParse from '../onboarding/SafeParse';

// The same tile the onboarding wizard uses, so a merchant who picked a style
// during setup meets the identical control when they come back to change it.
const RADIO_GROUP = 'power-coupons-settings-coupon-style';

const CouponTemplatePicker = ( {
	name,
	value,
	title,
	description,
	disabled = false,
} ) => {
	const couponStyles = window.powerCouponsSettings.coupon_templates || {};
	const styleLabels =
		window.powerCouponsSettings.coupon_template_labels || {};
	const styleKeys = Object.keys( couponStyles );

	const [ data, dispatch ] = useStateValue();

	const updateValue = ( _couponStyle ) => {
		// Create a deep copy to avoid mutation issues
		const newData = JSON.parse( JSON.stringify( data ) );
		const elements = name.split( /[\[\]]/ ).filter( ( el ) => el );

		if ( elements.length >= 2 ) {
			newData[ elements[ 0 ] ][ elements[ 1 ] ] = _couponStyle;
		}

		dispatch( {
			type: 'CHANGE',
			data: newData,
		} );
	};

	const selectedStyle = value || styleKeys[ 0 ];

	return (
		<FieldWrapper
			disabled={ disabled }
			type="block"
			title={ title }
			description={ description }
		>
			{ ! styleKeys.length && (
				<p className="m-0 py-6 px-4 text-sm text-text-secondary text-center border border-dashed border-border-subtle rounded-lg">
					{ __(
						'No coupon styles are available right now. Power Coupons will use its default styling.',
						'power-coupons'
					) }
				</p>
			) }

			{ /* Grid, not a flex row — two ticket previews side by side used to
			     push the second one clean off a narrow screen. */ }
			<div
				role="radiogroup"
				aria-label={ title || __( 'Coupon Styling', 'power-coupons' ) }
				className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3"
			>
				{ styleKeys.map( ( styleKey, index ) => (
					<OptionTile
						key={ styleKey }
						group={ RADIO_GROUP }
						value={ styleKey }
						checked={ selectedStyle === styleKey }
						onChange={ updateValue }
						name={
							styleLabels[ styleKey ] ||
							sprintf(
								/* translators: %d: coupon style number. */
								__( 'Style %d', 'power-coupons' ),
								index + 1
							)
						}
					>
						{ /* The card templates are fixed-width SVGs — let them
						     scale down instead of overflowing the tile. */ }
						<span className="power-coupons-coupon-style-preview block w-full max-w-[314px] [&_svg]:w-full [&_svg]:h-auto">
							{ safeParse( couponStyles[ styleKey ] ) }
						</span>
					</OptionTile>
				) ) }
			</div>
		</FieldWrapper>
	);
};

export default CouponTemplatePicker;
