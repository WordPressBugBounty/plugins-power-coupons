import { __ } from '@wordpress/i18n';
import FieldWrapper from '../wrappers/FieldWrapper';
import CategorySelector from '../common/CategorySelector';
import { useStateValue } from '../Data';
import {
	buildControlId,
	parseFieldName,
	setNestedValue,
	getNestedValue,
} from './fieldUtils';

function CategorySearchField( props ) {
	const { title, description, name, disabled = false } = props;
	const [ data, dispatch ] = useStateValue();
	const parts = parseFieldName( name );
	const value = getNestedValue( data, parts ) || [];
	const controlId = buildControlId( 'search-categories', name );

	const handleChange = ( ids ) => {
		const newData = setNestedValue( data, parts, ids );
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
				<CategorySelector
					label=""
					placeholder={ __( 'Search categories…', 'power-coupons' ) }
					value={ value }
					onChange={ handleChange }
					inputId={ controlId }
					disabled={ disabled }
					labelledBy={ `${ controlId }-title` }
				/>
			</div>
		</FieldWrapper>
	);
}

export default CategorySearchField;
