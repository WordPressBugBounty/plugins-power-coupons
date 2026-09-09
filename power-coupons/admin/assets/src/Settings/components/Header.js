import { __ } from '@wordpress/i18n';
import { Link } from 'react-router-dom';
import { Badge, Topbar } from '@bsf/force-ui';

import Logo from '../../../images/logo.svg';

import { useStateValue } from './Data';
import VersionBadge from './VersionBadge';

const menus = powerCouponsSettings.admin_header_menus;

// Where the license badge sends an unlicensed site. Matches the sidebar's own
// route so both land on the same screen.
const LICENSE_ROUTE = {
	pathname: 'admin.php',
	search: '?page=power_coupons_settings&path=settings&tab=power_coupons_license',
};

function Header( props ) {
	const { activePath } = props;
	const [ data ] = useStateValue();
	const isLicenseActivated = 'Activated' === data?.license_status;

	return (
		<div className="-ml-2.5 md:-ml-5 power_coupons-header--wrapper">
			<Topbar
				className="power_coupons-header--content h-16 min-h-[unset] p-0 border-0 border-b border-solid border-border-subtle bg-white relative z-10"
				gap={ 0 }
				role="navigation"
				aria-label={ __( 'Main Navigation', 'power-coupons' ) }
			>
				<Topbar.Left className="power_coupons-header--content-left lg:px-5 px-3">
					<Topbar.Item>
						<img
							className="lg:block h-[2.6rem] w-auto"
							src={ Logo }
							alt={ __( 'Power Coupons', 'power-coupons' ) }
						/>
					</Topbar.Item>
				</Topbar.Left>
				<Topbar.Middle
					align="left"
					className="power_coupons-header--content-middle h-full gap-2 md:gap-4"
					role="menubar"
				>
					{ menus.map( ( menu ) => (
						<Topbar.Item
							className="h-full"
							key={ `?page=power_coupons_settings&path=${ menu.path }` }
							role="menuitem"
						>
							{ /* `focus:shadow-none` used to cancel the only
							indicator these links had, leaving the first three
							tab stops on every screen with a fully transparent
							2px outline and nothing else — invisible to anyone
							navigating by keyboard. */ }
							<Link
								to={ {
									pathname: 'admin.php',
									search: `?page=power_coupons_settings${
										'' !== menu.path
											? '&path=' + menu.path
											: ''
									}`,
								} }
								className={ `${
									activePath === menu.path
										? ' border-wpcolor hover:text-wphovercolor text-text-primary inline-flex items-center px-1 border-b-2 text-sm font-medium'
										: 'border-transparent text-text-secondary hover:border-border-subtle hover:text-text-secondary inline-flex items-center px-1 border-b-2 text-sm font-medium'
								} no-underline h-full border-solid border-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wpcolor focus-visible:ring-offset-2 rounded-sm` }
								aria-current={
									activePath === menu.path
										? 'page'
										: undefined
								}
							>
								{ menu.name }
							</Link>
						</Topbar.Item>
					) ) }
				</Topbar.Middle>
				<Topbar.Right
					className="power_coupons-header--content-right p-2 md:p-4 gap-2 md:gap-4 min-w-0 shrink"
					gap="md"
				>
					{ /* Activated, this is a status read-out and nothing more.
					Unactivated, it names the thing the merchant has to go and
					do, so it becomes the link that takes them there. Note that
					Force UI's `Badge` renders a bare span and forwards no
					unknown props, so an `aria-label` on it would be dropped —
					the accessible name has to live on the link. */ }
					{ !! data?.pro_version && (
						<Topbar.Item className="hidden sm:flex">
							{ isLicenseActivated ? (
								<Badge
									size="xs"
									type="rounded"
									variant="green"
									disableHover
									label={ __(
										'Valid License',
										'power-coupons'
									) }
								/>
							) : (
								<Link
									to={ LICENSE_ROUTE }
									aria-label={ __(
										'Activate your license',
										'power-coupons'
									) }
									className="inline-flex no-underline rounded focus:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wpcolor focus-visible:ring-offset-2"
								>
									<Badge
										size="xs"
										type="rounded"
										variant="red"
										label={ __(
											'Activate License',
											'power-coupons'
										) }
									/>
								</Link>
							) }
						</Topbar.Item>
					) }
					{ /* Version badges are reference information a merchant
					needs about once. Below `md` they are the widest thing in
					the header and pushed the bar 107px past a 390px viewport,
					so they step aside rather than force a horizontal scroll. */ }
					<Topbar.Item className="hidden md:flex items-center space-x-1 lg:space-x-3">
						<VersionBadge />
					</Topbar.Item>
				</Topbar.Right>
			</Topbar>
		</div>
	);
}

export default Header;
