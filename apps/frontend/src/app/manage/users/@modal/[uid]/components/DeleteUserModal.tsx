'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import Modal from '~/core/ui/Modal';
import Button from '~/core/ui/Button';
import { deleteUserAction } from '~/app/manage/users/@modal/[uid]/actions.server';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';

function DeleteUserModal({
  user,
}: React.PropsWithChildren<{
  user: {
    id: string;
    email?: string;
    displayName?: string;
  };
}>) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const displayText = user.displayName ?? user.email ?? user.id;

  const onDismiss = () => {
    router.back();

    setIsOpen(false);
  };

  const onConfirm = () => {
    startTransition(async () => {
      await deleteUserAction({
        userId: user.id,
      });

      onDismiss();
    });
  };

  return (
    <Modal heading={'Deleting User'} isOpen={isOpen} setIsOpen={onDismiss}>
      <form action={onConfirm}>
        <div className="flex flex-col space-y-6 text-left">
          <div className="flex flex-col space-y-3 text-sm text-muted-foreground">
            <p>
              You are about to delete the user{' '}
              <span className="font-semibold text-foreground">{displayText}</span>.
            </p>

            <p>
              This will also remove any organizations where they are the owner and
              potentially associated data.
            </p>

            <p className="font-semibold text-destructive">
              This action cannot be undone.
            </p>

            <p>Type DELETE below to confirm you understand the consequences.</p>
          </div>

          <TextFieldLabel>
            Confirm by typing <span className="font-semibold text-foreground">DELETE</span>
            <TextFieldInput required type={'text'} pattern={'DELETE'} />
          </TextFieldLabel>

          <div className="flex justify-end gap-3">
            <Modal.CancelButton disabled={pending} onClick={onDismiss}>
              Cancel
            </Modal.CancelButton>

            <Button loading={pending} variant={'destructive'}>
              Yes, delete user
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default DeleteUserModal;
