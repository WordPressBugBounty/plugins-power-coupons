import Text from '../fields/Text';
import FieldWrapper from '../wrappers/FieldWrapper';
import { buildControlId } from './fieldUtils';

function TextField( props ) {
	const { title, description, disabled = false } = props;
	const controlId = buildControlId( 'input-text', props.name );

	return (
		<FieldWrapper
			title={ title }
			description={ description }
			type="block"
			disabled={ disabled }
			controlId={ controlId }
		>
			<div className="flex-grow">
				<Text
					id={ controlId }
					name={ props.name }
					val={ props.value }
					max={ props.max }
					disabled={ disabled }
				/>
			</div>
		</FieldWrapper>
	);
}

export default TextField;
