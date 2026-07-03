'use client';

import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { useState } from 'react';

import { banUser } from '~/app/manage/users/@modal/[uid]/actions.server';

import Modal from '~/core/ui/Modal';
import Button from '~/core/ui/Button';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';
import ErrorBoundary from '~/core/ui/ErrorBoundary';
import Alert from '~/core/ui/Alert';

function BanUserModal({
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
  const displayText = user.displayName ?? user.email ?? user.id;

  const onDismiss = () => {
    router.back();

    setIsOpen(false);
  };

  const onConfirm = async () => {
    await banUser({
      userId: user.id,
    });

    onDismiss();
  };

  return (
    <Modal heading={'Ban User'} isOpen={isOpen} setIsOpen={onDismiss}>
      <ErrorBoundary fallback={<BanErrorAlert />}>
        <form action={onConfirm}>
          <div className="flex flex-col space-y-6 text-left">
            <div className="flex flex-col space-y-3 text-sm text-muted-foreground">
              <p>
                You are about to ban <span className="font-semibold text-foreground">{displayText}</span>.
              </p>

              <p>
                The user will not be able to log in or use their account until you unban them.
              </p>

              <TextFieldLabel>
                Type <span className="font-semibold text-foreground">BAN</span> to confirm
                <TextFieldInput type="text" required pattern={'BAN'} />
              </TextFieldLabel>

              <p>Are you sure you want to continue?</p>
            </div>

            <div className="flex justify-end gap-3">
              <Modal.CancelButton onClick={onDismiss}>
                Cancel
              </Modal.CancelButton>

              <SubmitButton />
            </div>
          </div>
        </form>
      </ErrorBoundary>
    </Modal>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} variant={'destructive'}>
      Yes, ban user
    </Button>
  );
}

export default BanUserModal;

function BanErrorAlert() {
  return (
    <Alert type={'error'}>
      <Alert.Heading>There was an error banning this user.</Alert.Heading>
      Check the logs for more information.
    </Alert>
  );
}
