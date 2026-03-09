import Text from '../fields/Text';
import FieldWrapper from '../wrappers/FieldWrapper';

function TextField( props ) {
	const { title, description } = props;

	return (
		<FieldWrapper title={ title } description={ description } type="block">
			<div className="flex-grow">
				<Text
					name={ props.name }
					val={ props.value }
					max={ props.max }
				/>
			</div>
		</FieldWrapper>
	);
}

export default TextField;
