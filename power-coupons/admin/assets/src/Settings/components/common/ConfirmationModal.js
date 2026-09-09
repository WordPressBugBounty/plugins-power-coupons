import { Dialog, Button, Loader } from '@bsf/force-ui';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { __ } from '@wordpress/i18n';

/**
 * Destructive confirmation dialog.
 *
 * Built from the shared `Dialog` sub-components so it matches the other
 * dialogs in the settings app (see the onboarding exit dialog) instead of
 * laying out its own header and footer.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen      Whether the dialog is open.
 * @param {Function} props.onClose     Called when the user dismisses without confirming.
 * @param {Function} props.onConfirm   Called when the user confirms.
 * @param {string}   props.title       Heading text.
 * @param {string}   props.message     Supporting text under the heading.
 * @param {string}   props.confirmText Label for the destructive button.
 * @param {string}   props.cancelText  Label for the cancel button.
 * @param {boolean}  props.isLoading   True while the confirmed action is running.
 */
const ConfirmationModal = ( {
	isOpen,
	onClose,
	onConfirm,
	title = __( 'Confirm Delete', 'power-coupons' ),
	message = __(
		'Are you sure you want to delete this item? This action cannot be undone.',
		'power-coupons'
	),
	confirmText = __( 'Delete', 'power-coupons' ),
	cancelText = __( 'Cancel', 'power-coupons' ),
	isLoading = false,
} ) => {
	// Once the confirmed action is in flight the dialog must not be
	// dismissable: closing it would hide a request that is still running and
	// leave the caller with no way to report its outcome. The confirm button
	// shows a spinner for the same span, so the lock is never silent.
	const handleClose = () => {
		if ( isLoading ) {
			return;
		}
		onClose();
	};

	// Called without the click event on purpose, so callers are free to accept
	// an argument of their own without receiving a MouseEvent instead.
	const handleConfirm = () => {
		onConfirm();
	};

	return (
		<Dialog
			open={ isOpen }
			setOpen={ handleClose }
			exitOnEsc={ ! isLoading }
			design="simple"
		>
			<Dialog.Backdrop />
			{ /* The panel is a fixed 30rem wide by default and would overflow a
			     narrow viewport, so cap it to the viewport minus its own margin. */ }
			<Dialog.Panel className="max-w-[calc(100vw-2rem)]">
				{ /* Deliberately no close (X) button. Cancel already is the
				     labelled safe exit, and an X in the header would take the
				     dialog's initial focus away from it. */ }
				<Dialog.Header className="space-y-0">
					<div className="flex items-start gap-4">
						<span
							aria-hidden="true"
							className="flex size-10 shrink-0 items-center justify-center rounded-full bg-alert-background-danger"
						>
							<ExclamationTriangleIcon className="size-5 text-support-error" />
						</span>
						<div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
							<Dialog.Title className="text-balance">
								{ title }
							</Dialog.Title>
							<Dialog.Description className="mr-0 text-pretty">
								{ message }
							</Dialog.Description>
						</div>
					</div>
				</Dialog.Header>

				<Dialog.Footer>
					<Button
						variant="outline"
						onClick={ handleClose }
						disabled={ isLoading }
					>
						{ cancelText }
					</Button>
					{ /* `loading` only dims this button, so the spinner has to
					     be passed in as the icon to make progress visible. */ }
					<Button
						variant="primary"
						destructive
						onClick={ handleConfirm }
						loading={ isLoading }
						disabled={ isLoading }
						icon={
							isLoading ? (
								<Loader variant="secondary" size="sm" />
							) : null
						}
					>
						{ confirmText }
					</Button>
				</Dialog.Footer>
			</Dialog.Panel>
		</Dialog>
	);
};

export default ConfirmationModal;
