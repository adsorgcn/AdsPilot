'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import Modal from '~/core/ui/Modal';
import Button from '~/core/ui/Button';
import { reactivateUser } from '~/app/manage/users/@modal/[uid]/actions.server';

function ReactivateUserModal({
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
      await reactivateUser({
        userId: user.id,
      });

      onDismiss();
    });
  };

  return (
    <Modal heading={'Reactivate User'} isOpen={isOpen} setIsOpen={onDismiss}>
      <div className="flex flex-col space-y-6 text-left">
        <div className="flex flex-col space-y-3 text-sm text-muted-foreground">
          <p>
            You are about to reactivate the account belonging to{' '}
            <span className="font-semibold text-foreground">{displayText}</span>.
          </p>

          <p>The user will immediately regain access to the application.</p>

          <p>Are you sure you want to continue?</p>
        </div>

        <div className="flex justify-end gap-3">
          <Modal.CancelButton disabled={pending} onClick={onDismiss}>
            Cancel
          </Modal.CancelButton>

          <Button loading={pending} onClick={onConfirm}>
            Yes, reactivate user
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ReactivateUserModal;
