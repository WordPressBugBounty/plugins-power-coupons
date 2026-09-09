import { Label, Switch } from '@bsf/force-ui';
import { __, sprintf } from '@wordpress/i18n';
import { Header, NavButtons, OptionTile } from '../Components';
import { useOnboardingContext } from '../Context';
import safeParse from '../SafeParse';

const ToggleRow = ( { id, title, description, value, onChange } ) => (
	<section className="flex items-start justify-between gap-4 py-5 border-0 border-b border-solid border-border-subtle last:border-b-0">
		<div className="min-w-0 flex flex-col gap-1">
			<Label
				htmlFor={ id }
				className="text-sm font-medium text-text-primary"
			>
				{ title }
			</Label>
			<p className="m-0 text-sm font-normal text-text-secondary">
				{ description }
			</p>
		</div>
		<Switch
			id={ id }
			size="sm"
			value={ value }
			onChange={ onChange }
			className="shrink-0 mt-0.5 [&>input]:!border-none"
			aria-label={ title }
		/>
	</section>
);

const ConfigureCoupons = () => {
	const { currentScreenData, handleData } = useOnboardingContext();

	const couponStyles = window.powerCouponsSettings.coupon_templates || {};
	const styleLabels =
		window.powerCouponsSettings.coupon_template_labels || {};
	const styleKeys = Object.keys( couponStyles );
	const selectedStyle = currentScreenData.coupon_style || styleKeys[ 0 ];

	return (
		<>
			<Header
				heading={ __( 'Configure Your Coupons', 'power-coupons' ) }
				subHeading={ __(
					"Set up coupon settings to match your store's needs in just a few clicks.",
					'power-coupons'
				) }
			/>

			<section className="flex flex-col gap-3 pb-5 border-0 border-b border-solid border-border-subtle">
				<div className="flex flex-col gap-1">
					<Label
						as="span"
						className="text-sm font-semibold text-text-primary"
					>
						{ __( 'Choose Coupon Styling', 'power-coupons' ) }
					</Label>
					<p className="m-0 text-sm font-normal text-text-secondary">
						{ __(
							'This is how coupons will appear to your customers.',
							'power-coupons'
						) }
					</p>
				</div>

				{ ! styleKeys.length && (
					<p className="m-0 py-6 px-4 text-sm text-text-secondary text-center border border-dashed border-border-subtle rounded-lg">
						{ __(
							'No coupon styles are available right now. Power Coupons will use its default styling, and you can pick a different one later from Settings.',
							'power-coupons'
						) }
					</p>
				) }

				{ /* Grid, not a flex row — two ticket previews side by side used to
				     push the second one clean off a phone screen. */ }
				<div
					role="radiogroup"
					aria-label={ __( 'Coupon Styling', 'power-coupons' ) }
					className="grid grid-cols-1 sm:grid-cols-2 gap-4"
				>
					{ styleKeys.map( ( styleKey, index ) => (
						<OptionTile
							key={ styleKey }
							group="power-coupons-coupon-style"
							value={ styleKey }
							checked={ selectedStyle === styleKey }
							onChange={ ( value ) =>
								handleData( 'coupon_style', value )
							}
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
			</section>

			<div className="flex flex-col">
				<ToggleRow
					id="power-coupons-show-on-cart"
					title={ __( 'Show Coupons on Cart', 'power-coupons' ) }
					description={ __(
						'Display available coupons on the cart page so customers can easily apply discounts.',
						'power-coupons'
					) }
					value={ currentScreenData.show_on_cart }
					onChange={ ( value ) =>
						handleData( 'show_on_cart', value )
					}
				/>

				<ToggleRow
					id="power-coupons-show-on-checkout"
					title={ __( 'Show Coupons on Checkout', 'power-coupons' ) }
					description={ __(
						'Display available coupons on the checkout page to boost conversions.',
						'power-coupons'
					) }
					value={ currentScreenData.show_on_checkout }
					onChange={ ( value ) =>
						handleData( 'show_on_checkout', value )
					}
				/>

				<ToggleRow
					id="power-coupons-enable-for-guests"
					title={ __( 'Enable for Guest Users', 'power-coupons' ) }
					description={ __(
						'Let shoppers who are not logged in see and use available coupons.',
						'power-coupons'
					) }
					value={ currentScreenData.enable_for_guests }
					onChange={ ( value ) =>
						handleData( 'enable_for_guests', value )
					}
				/>
			</div>

			<NavButtons nextLabel={ __( 'Continue', 'power-coupons' ) } />
		</>
	);
};

export default ConfigureCoupons;
