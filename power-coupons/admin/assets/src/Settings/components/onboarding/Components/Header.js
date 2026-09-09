import { Title, Label, Badge } from '@bsf/force-ui';

/**
 * Step heading.
 *
 * Renders a real heading element — the wizard previously used a 30px <label>
 * for every screen title, so the document had no outline at all.
 *
 * Every step is its own view, so every step title is the h1 for that view;
 * three of the five screens used to start their outline at h2 with no h1 above
 * them. Level and scale are separate props because of that: the screens that
 * open and close the wizard ask to be felt rather than filled in, and they were
 * reading at exactly the same 20px as every form step in between.
 *
 * @param {Object} props
 * @param {string} props.heading      Screen title.
 * @param {string} [props.subHeading] Supporting sentence.
 * @param {string} [props.badge]      Optional pill beside the title (e.g. setup duration).
 * @param {string} [props.tag]        Heading level. Defaults to h1.
 * @param {string} [props.size]       Force UI Title scale — `md` (20px) or `lg` (24px).
 */
export default ( { heading, subHeading, badge, tag = 'h1', size = 'md' } ) => (
	<div className="flex flex-col gap-2">
		<div className="flex flex-wrap items-center gap-3">
			<Title
				size={ size }
				tag={ tag }
				className="text-text-primary tracking-[-0.02em]"
				title={ heading }
			/>
			{ badge && (
				<Badge
					label={ badge }
					type="pill"
					size="xs"
					variant="neutral"
					disableHover
				/>
			) }
		</div>
		{ subHeading && (
			<Label className="text-text-secondary text-sm font-normal block">
				{ subHeading }
			</Label>
		) }
	</div>
);
