import FieldRenderer, { isFieldVisible } from '../common/FieldRenderer';
import { useStateValue } from '../Data';
import {
	groupFieldsBySection,
	hasNoTitledGroups,
	sortFieldsByPriority,
} from './fieldSections';

/**
 * Render a tab's fields as one card per declared section.
 *
 * Tabs disable their fields two different ways: most have a single master
 * toggle that greys out everything else, while the sub-tab screens run a
 * cascade with several levels. Pass `isFieldDisabled` for the latter; without
 * it the master-toggle behaviour applies.
 *
 * @param {Object}   props                 Component props.
 * @param {string}   props.tabKey          Settings tab slug; picks the fallback
 *                                         headings for untitled sections.
 * @param {Array}    props.fields          Field definitions for the tab.
 * @param {boolean}  props.masterDisabled  Whether the tab's master toggle is off.
 * @param {string}   props.masterFieldName Name of that master toggle.
 * @param {Function} props.isFieldDisabled Optional per-field disable predicate.
 * @return {JSX.Element} The rendered cards.
 */
function SectionRenderer( {
	tabKey = '',
	fields,
	masterDisabled = false,
	masterFieldName = '',
	isFieldDisabled = null,
} ) {
	const [ data ] = useStateValue();

	const disabledFor = ( field ) =>
		isFieldDisabled
			? isFieldDisabled( field.name )
			: masterDisabled && field.name !== masterFieldName;

	const renderField = ( field ) => (
		<FieldRenderer
			key={ field.name }
			field={ field }
			disabled={ disabledFor( field ) }
		/>
	);

	const groups = groupFieldsBySection( fields, tabKey );

	// A tab whose sections carry no title, and none free can supply, keeps the
	// single-card layout it has always had — no heading, no extra chrome.
	if ( hasNoTitledGroups( groups ) ) {
		return (
			<div className="h-auto px-6 bg-background-primary rounded-xl shadow-sm">
				{ sortFieldsByPriority( fields ).map( renderField ) }
			</div>
		);
	}

	return (
		<>
			{ groups.map( ( group ) => {
				// A section whose fields are all hidden by their conditions
				// would otherwise render as an empty titled card.
				const visibleFields = group.fields.filter( ( field ) =>
					isFieldVisible( field, data )
				);

				if ( 0 === visibleFields.length ) {
					return null;
				}

				return (
					<div
						key={ group.key }
						className="h-auto px-6 bg-background-primary rounded-xl shadow-sm mb-6 last:mb-0"
					>
						{ group.title && (
							<h3 className="text-base font-semibold text-text-primary m-0 pt-6 leading-6">
								{ group.title }
							</h3>
						) }
						{ visibleFields.map( renderField ) }
					</div>
				);
			} ) }
		</>
	);
}

export default SectionRenderer;
