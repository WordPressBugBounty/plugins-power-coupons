import { Fragment } from 'react';
import parse from 'html-react-parser';

/**
 * Render a trusted HTML string from the settings registration.
 *
 * `html-react-parser` returns a single element for markup with one root and an
 * *array* for anything with several — an icon string with a stray newline, a
 * helper line with a link in the middle of a sentence. Handing that array
 * straight to JSX is what produced the "Each child in a list should have a
 * unique key prop" warning on every settings screen. Keying the array here
 * fixes it once for every caller.
 *
 * @param {Object} props      Component props.
 * @param {string} props.html Markup to render.
 * @return {JSX.Element|null} The parsed markup.
 */
const ParsedHtml = ( { html } ) => {
	if ( ! html ) {
		return null;
	}

	const nodes = parse( html );

	if ( ! Array.isArray( nodes ) ) {
		return nodes;
	}

	return nodes.map( ( node, index ) => (
		// eslint-disable-next-line react/no-array-index-key
		<Fragment key={ index }>{ node }</Fragment>
	) );
};

export default ParsedHtml;
