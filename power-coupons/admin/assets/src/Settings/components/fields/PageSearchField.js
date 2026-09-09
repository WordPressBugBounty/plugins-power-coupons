import { __ } from '@wordpress/i18n';
import FieldWrapper from '../wrappers/FieldWrapper';
import PageSelector from './PageSelector';
import { useStateValue } from '../Data';
import {
	buildControlId,
	parseFieldName,
	setNestedValue,
	getNestedValue,
} from './fieldUtils';

function PageSearchField( props ) {
	const { title, description, name, disabled = false } = props;
	const [ data, dispatch ] = useStateValue();
	const parts = parseFieldName( name );
	const value = getNestedValue( data, parts ) || 0;
	const controlId = buildControlId( 'search-pages', name );

	const handleChange = ( id ) => {
		const newData = setNestedValue( data, parts, id );
		dispatch( { type: 'CHANGE', data: newData } );
	};

	return (
		<FieldWrapper
			title={ title }
			description={ description }
			type="block"
			disabled={ disabled }
			controlId={ controlId }
		>
			<div className="flex-grow">
				<PageSelector
					placeholder={ __( 'Search pages…', 'power-coupons' ) }
					value={ value }
					onChange={ handleChange }
					portalId="power-coupons-settings"
					inputId={ controlId }
					disabled={ disabled }
					labelledBy={ `${ controlId }-title` }
				/>
			</div>
		</FieldWrapper>
	);
}

export default PageSearchField;
