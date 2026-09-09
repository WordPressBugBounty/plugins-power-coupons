import { useEffect, useRef, useState } from 'react';
import {
	Accordion,
	Badge,
	Container,
	Label,
	Menu,
	Sidebar,
} from '@bsf/force-ui';
import { ChevronDown } from 'lucide-react';
import { __ } from '@wordpress/i18n';

import FieldContainer from '../wrappers/FieldContainer';
import LicenseNotice from '../tabs/LicenseNotice';
import LicenseSettings from '../tabs/LicenseSettings';
import { getVisibleSubtabs } from '../common/fieldSections';
import useLocalStorageState from '../common/hooks/useLocalStorageState';
import { useStateValue } from '../Data';

import ParsedHtml from '../common/ParsedHtml';

// Prefix for the per-group localStorage keys holding each sidebar submenu
// group's collapsed/expanded boolean. One key per group so toggling one never
// clobbers another's saved state, and the choice survives tab switches (which
// remount the accordions) and full page reloads.
const SIDEBAR_SUBMENU_STATE_KEY_PREFIX = 'power_coupons_sidebar_submenu_state_';

/**
 * One expandable group of sub-pages in the sidebar.
 *
 * @param {Object}      props                 Component props.
 * @param {Object}      props.item            Nav item for the parent tab.
 * @param {Array}       props.subs            Populated sub-tabs of that tab.
 * @param {JSX.Element} props.icon            Rendered tab icon.
 * @param {JSX.Element} props.label           Rendered tab label.
 * @param {boolean}     props.isCurrent       Whether this tab is the active one.
 * @param {string}      props.activeSubtab    Slug of the active sub-page.
 * @param {boolean}     props.railExpanded    Whether the narrow rail is open.
 * @param {Function}    props.setRailExpanded Opens or closes the narrow rail.
 * @param {Function}    props.navigate        Routes to a tab and sub-page.
 * @return {JSX.Element} The group.
 */
const SidebarSubmenu = ( {
	item,
	subs,
	icon,
	label,
	isCurrent,
	activeSubtab,
	railExpanded,
	setRailExpanded,
	navigate,
} ) => {
	// `undefined` means "no explicit user choice stored" -> derive from route.
	const [ storedOpen, setStoredOpen ] = useLocalStorageState(
		`${ SIDEBAR_SUBMENU_STATE_KEY_PREFIX }${ item.slug }`,
		undefined
	);

	const isOpen = undefined !== storedOpen ? storedOpen : isCurrent;

	// Auto-expand only when the user newly navigates INTO this group
	// (false -> true of isCurrent). Never auto-collapse, so manually collapsing
	// the group you are already in sticks.
	const prevActiveRef = useRef( isCurrent );
	useEffect( () => {
		const wasActive = prevActiveRef.current;
		prevActiveRef.current = isCurrent;
		if ( isCurrent && ! wasActive ) {
			setStoredOpen( true );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isCurrent ] );

	const handleTrigger = ( event ) => {
		// The trigger carries `type="button"` so it can no longer submit the
		// surrounding form; these two keep the click from also reaching the
		// accordion's own toggle and the rows behind it.
		event.preventDefault();
		event.stopPropagation();

		if ( ! subs?.length ) {
			return;
		}

		// Below `lg` the rail is a 64px icon strip with no room for sub-items,
		// so the first tap opens the rail over the content instead.
		const isNarrow =
			typeof window !== 'undefined' &&
			! window.matchMedia( '(min-width: 1024px)' ).matches;

		if ( isNarrow && ! railExpanded ) {
			setRailExpanded( true );
			setStoredOpen( true );
			return;
		}

		const next = ! isOpen;
		setStoredOpen( next );

		// Land on a sub-page only when opening, never when collapsing.
		if ( next ) {
			navigate( item.slug, subs[ 0 ].slug );
		}
	};

	return (
		// `Menu.List` renders `<ul role="menu">`, which may only own `<li>`
		// elements. `Accordion.Item` is a div, so it needs a list item of its
		// own — `role="none"` because the group row itself is the menu item,
		// not this wrapper.
		<li role="none" className="list-none m-0 p-0">
			{ /* Hand-rolled rather than `Accordion.Trigger`, for one reason
			that matters and one that is a bonus.

			`Accordion.Trigger` renders a `<button>` and never sets `type`, so
			it is a submit button — and it consumes a `type` prop as its own
			style variant, so it cannot be told otherwise from outside. Three
			of them inside the settings `<form>` gave the form a default
			button, and Enter in any settings field clicked the first one:
			the merchant was thrown onto another tab and any edit still inside
			the field's 500ms debounce was dropped.

			The bonus is that owning the markup means the row can carry
			`Menu.Item`'s own classes and sit flush with the plain rows,
			instead of overriding a nested div's colour and weight to
			un-do styling this component never wanted. */ }
			<button
				type="button"
				onClick={ handleTrigger }
				aria-expanded={ isOpen }
				aria-label={ `${ item.name } submenu` }
				title={ item.name }
				className={ `w-full m-0 h-9 p-1 flex items-center gap-1 rounded border-none bg-transparent cursor-pointer text-base text-left transition ease-in-out duration-150 hover:bg-wphovercolorfaded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wpcolor focus-visible:ring-offset-1 ${
					isCurrent
						? 'bg-wphovercolorfaded text-text-primary font-medium'
						: 'text-text-secondary font-normal'
				} ${
					railExpanded
						? 'justify-start'
						: 'lg:justify-start justify-center'
				}` }
			>
				<span
					className={ `flex shrink-0 items-center justify-center m-1.5 [&>svg]:size-5 ${
						isCurrent
							? 'text-icon-interactive'
							: 'text-icon-secondary'
					}` }
				>
					{ icon }
				</span>
				{ label }
				<span
					className={ `ml-auto mr-1.5 flex shrink-0 items-center text-icon-secondary [&>svg]:size-5 ${
						railExpanded ? '' : 'hidden lg:flex'
					}` }
				>
					<ChevronDown
						aria-hidden="true"
						className={ `transition-transform duration-300 ease-in-out ${
							isOpen ? 'rotate-180' : 'rotate-0'
						}` }
					/>
				</span>
			</button>
			<Accordion.Item isOpen={ isOpen } className="border-0">
				<Accordion.Content
					className={ `p-2 [&>div]:pb-0 ${
						railExpanded ? '' : 'max-lg:hidden'
					}` }
				>
					<div
						className="border-l border-solid border-r-0 border-t-0 border-b-0 border-border-subtle pl-2 ml-1 space-y-0.5"
						role="menu"
					>
						{ subs.map( ( st ) => {
							const isActiveSub =
								isCurrent && activeSubtab === st.slug;

							return (
								<button
									key={ st.slug }
									type="button"
									role="menuitem"
									aria-current={
										isActiveSub ? 'page' : undefined
									}
									onClick={ () => {
										navigate( item.slug, st.slug );
										setRailExpanded( false );
									} }
									className={ `w-full flex items-center justify-start gap-2.5 py-2 pl-2.5 pr-2 rounded-md text-base text-left bg-transparent border-none cursor-pointer transition ease-in-out duration-150 hover:bg-wphovercolorfaded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wpcolor focus-visible:ring-offset-1 ${
										isActiveSub
											? 'bg-wphovercolorfaded text-text-primary font-medium'
											: 'font-normal text-text-secondary'
									}` }
								>
									{ st.title }
								</button>
							);
						} ) }
					</div>
				</Accordion.Content>
			</Accordion.Item>
		</li>
	);
};

function Settings( props ) {
	const { navigation, tab, subtab, navigate } = props;
	const [ data ] = useStateValue();

	// Which sub-page is showing. The URL wins; fall back to the first
	// populated sub-tab so a bare ?tab= link still lands somewhere real.
	const currentSubtabs = getVisibleSubtabs( tab );
	const activeSubtab = currentSubtabs.some( ( st ) => st.slug === subtab )
		? subtab
		: currentSubtabs[ 0 ]?.slug ?? '';

	const [ railExpanded, setRailExpanded ] = useState( false );

	const showLicenseNotice =
		!! data?.pro_version &&
		'Activated' !== data.license_status &&
		'power_coupons_license' !== tab;

	// PRO-upsell tabs render a full-width feature card instead of a form, so
	// they get the full content width rather than the narrow settings column.
	const currentTab =
		window.powerCouponsSettings?.settings_tabs?.[ tab ] || {};
	const isProUpsellTab =
		!! currentTab.is_pro_upsell &&
		! window.powerCouponsSettings?.is_pro_active;
	return (
		<>
			{ /* Two elements, two jobs, because one cannot do both.

			The outer div is the rail itself: `self-stretch` makes it reach the
			bottom of a long settings column (an explicit cross-size such as
			`h-full` cancels `align-self: stretch`, which is what used to leave a
			ragged edge), and `min-h-screen` floors it on short tabs.

			Its background is painted twice: once on the element, and once by a
			viewport-fixed `::before` layer. The element can only ever be as
			tall as its flex row, but the document is taller than that whenever
			WordPress's own admin menu outruns it — so at the bottom of a scroll
			the rail ran out and left a blank strip. A `fixed` layer spans the
			viewport no matter how far the page has scrolled. `isolate` keeps
			the `-z-10` layer above the row's grey background instead of behind
			it. Same approach SureRank uses for its sidebar.

			The inner div is the part that sticks. It has to be a separate,
			content-height element: `position: sticky` can only travel by the
			difference between its own height and its container's, so a sticky
			element stretched to the full rail height has zero range and simply
			scrolls away. It also has to sit outside `Sidebar`, which sets
			`overflow: auto` — that would make itself the scrollport and stop the
			sticky resolving against the page. */ }
			{ railExpanded && (
				<button
					type="button"
					aria-label={ __( 'Close menu', 'power-coupons' ) }
					className="lg:hidden fixed inset-0 z-20 bg-misc-overlay border-none cursor-default"
					onClick={ () => setRailExpanded( false ) }
				/>
			) }
			<div
				className={ `mcw-sidebar self-stretch flex flex-col w-auto -ml-2.5 md:-ml-5 bg-background-primary relative isolate before:content-[''] before:fixed before:top-0 before:bottom-0 before:bg-background-primary before:-z-10 ${
					railExpanded
						? 'z-30 before:w-64'
						: 'before:w-16 lg:before:w-64'
				}` }
			>
				<div className="sticky top-0 lg:top-4 max-h-screen lg:max-h-[calc(100vh-2rem)] overflow-y-auto">
					<Sidebar
						borderOn
						className={ `!h-auto md:pl-3 lg:p-4 lg:w-64 border-none rounded-br-lg box-border ${
							railExpanded ? 'w-64 p-4 shadow-xl' : ''
						}` }
					>
						<Sidebar.Body>
							<Sidebar.Item>
								<Menu className="w-full p-0 gap-4" size="md">
									<Menu.List open>
										{ navigation.map( ( item ) => {
											const subs = getVisibleSubtabs(
												item.slug
											);
											const isLocked =
												!! powerCouponsSettings
													.settings_tabs?.[
													item.slug
												]?.is_pro_upsell &&
												! powerCouponsSettings.is_pro_active;
											const isCurrent = tab === item.slug;
											const showLabel = railExpanded
												? 'flex'
												: 'lg:flex hidden';

											const label = (
												<span
													className={ `${ showLabel } items-center gap-2 flex-1 min-w-0 m-1` }
												>
													{ item.name }
													{ isLocked && (
														<Badge
															size="xxs"
															variant="neutral"
															type="rounded"
															label={ __(
																'Pro',
																'power-coupons'
															) }
															disableHover
															className="ml-auto"
														/>
													) }
												</span>
											);

											const icon = (
												<ParsedHtml
													html={
														powerCouponsSettings
															.settings_icons[
															item.slug
														]
													}
												/>
											);

											// Tabs with more than one populated sub-tab become an
											// expandable group, following the sidebar submenu pattern
											// SureRank uses: a trigger row with an arrow, and the
											// children indented behind a left hairline.
											if ( subs.length > 1 ) {
												return (
													<SidebarSubmenu
														key={ item.slug }
														item={ item }
														subs={ subs }
														icon={ icon }
														label={ label }
														isCurrent={ isCurrent }
														activeSubtab={
															activeSubtab
														}
														railExpanded={
															railExpanded
														}
														setRailExpanded={
															setRailExpanded
														}
														navigate={ navigate }
													/>
												);
											}

											return (
												<Menu.Item
													key={ item.slug }
													active={ isCurrent }
													onClick={ () => {
														navigate(
															item.slug,
															subs[ 0 ]?.slug ??
																''
														);
														setRailExpanded(
															false
														);
													} }
													aria-label={ item.name }
													aria-current={
														isCurrent
															? 'page'
															: undefined
													}
													title={ item.name }
													className={ `h-9 ${
														railExpanded
															? 'justify-start'
															: 'lg:justify-start justify-center'
													} ${
														isCurrent &&
														'bg-wphovercolorfaded font-medium'
													} hover:bg-wphovercolorfaded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wpcolor focus-visible:ring-offset-1` }
												>
													{ icon }
													{ label }
												</Menu.Item>
											);
										} ) }
									</Menu.List>
								</Menu>
								<Container
									containerType="flex"
									direction="column"
									gap="xs"
									className={ `mt-7 rounded-md ${
										railExpanded
											? 'p-4 border border-solid border-wpcolor'
											: 'lg:p-4 lg:border lg:border-solid lg:border-wpcolor'
									}` }
								>
									<Container.Item
										className={ `gap-2 items-center ${
											railExpanded
												? 'flex'
												: 'lg:flex hidden'
										}` }
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											strokeWidth={ 2 }
											stroke="currentColor"
											className="h-5 w-5 text-wpcolor"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"></path>
											<path d="M21 16v2a4 4 0 0 1-4 4h-5"></path>
										</svg>
										<Label
											size="md"
											className="font-semibold"
										>
											{ __(
												'Need Support?',
												'power-coupons'
											) }
										</Label>
									</Container.Item>
									<Container.Item
										className={
											railExpanded
												? 'block'
												: 'lg:block hidden'
										}
									>
										<p className="font-normal text-sm text-text-field-helper m-0 pb-2">
											{ __(
												"We're happy to help!",
												'power-coupons'
											) }
										</p>
									</Container.Item>
									<Container.Item>
										<a
											href="https://cartflows.com/support"
											target="_blank"
											rel="noreferrer"
											className="flex justify-center p-2.5 no-underline text-white hover:text-white bg-wpcolor hover:bg-wphovercolor rounded-md box-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wpcolor focus-visible:ring-offset-2"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												strokeWidth={ 1.7 }
												stroke="currentColor"
												className={ `h-5 w-5 ${
													railExpanded
														? 'hidden'
														: 'block lg:hidden'
												}` }
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"></path>
												<path d="M21 16v2a4 4 0 0 1-4 4h-5"></path>
											</svg>
											<span
												className={ `text-center w-full text-sm font-semibold p-0 ${
													railExpanded
														? 'block'
														: 'lg:block hidden'
												}` }
											>
												{ __(
													'Request Support',
													'power-coupons'
												) }
											</span>
										</a>
									</Container.Item>
								</Container>
							</Sidebar.Item>
						</Sidebar.Body>
					</Sidebar>
				</div>
			</div>
			<Container
				className={ `w-full gap-0 ${
					isProUpsellTab
						? 'max-w-full mt-8 px-8 pb-8'
						: 'max-w-[43.5rem] mx-auto mt-8 pr-4 pb-5'
				}` }
				direction="column"
			>
				{ 'power_coupons_license' === tab && <LicenseSettings /> }
				{ 'power_coupons_license' !== tab && showLicenseNotice && (
					<LicenseNotice navigate={ navigate } />
				) }
				{ 'power_coupons_license' !== tab && ! showLicenseNotice && (
					<FieldContainer
						key={ `${ tab }-${ activeSubtab }` }
						tabKey={ tab }
						subtab={ activeSubtab }
					/>
				) }
			</Container>
		</>
	);
}

export default Settings;
