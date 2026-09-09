import parse, { domToReact } from 'html-react-parser';

const BLOCKED_TAGS = [ 'script', 'style', 'iframe', 'object', 'embed', 'link' ];

/**
 * Parse server-supplied markup without handing it a blank cheque.
 *
 * The coupon card previews are generated server-side and only an administrator
 * can reach this screen, so the risk is low — but nothing here needs scripting
 * or event handlers, so nothing here gets them.
 *
 * @param {string} html Markup to render.
 * @return {Node} React nodes.
 */
const safeParse = ( html ) =>
	parse( String( html || '' ), {
		replace( domNode ) {
			if ( 'tag' !== domNode.type ) {
				return undefined;
			}

			if ( BLOCKED_TAGS.includes( domNode.name ) ) {
				return <></>;
			}

			// Drop inline event handlers and javascript: URLs.
			const attribs = domNode.attribs || {};
			let mutated = false;

			Object.keys( attribs ).forEach( ( attr ) => {
				const isEventAttr = attr.toLowerCase().startsWith( 'on' );
				const isJsUrl =
					[ 'href', 'src', 'xlink:href' ].includes(
						attr.toLowerCase()
					) &&
					String( attribs[ attr ] )
						.trim()
						.toLowerCase()
						.startsWith( 'javascript:' );

				if ( isEventAttr || isJsUrl ) {
					delete attribs[ attr ];
					mutated = true;
				}
			} );

			if ( mutated ) {
				domNode.attribs = attribs;
			}

			return undefined;
		},
	} );

export { domToReact };
export default safeParse;
