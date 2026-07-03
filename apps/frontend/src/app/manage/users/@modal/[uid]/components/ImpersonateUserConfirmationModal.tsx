'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import Modal from '~/core/ui/Modal';
import Button from '~/core/ui/Button';
import If from '~/core/ui/If';

import { impersonateUser } from '~/app/manage/users/@modal/[uid]/actions.server';

import ImpersonateUserAuthSetter from '../components/ImpersonateUserAuthSetter';
import PageLoadingIndicator from '~/core/ui/PageLoadingIndicator';
import { Alert, AlertHeading } from '~/core/ui/Alert';

function ImpersonateUserConfirmationModal({
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
  const [error, setError] = useState<boolean>();

  const [tokens, setTokens] = useState<{
    accessToken: string;
    refreshToken: string;
  }>();

  const displayText = user.displayName ?? user.email ?? user.id;

  const onDismiss = () => {
    router.back();

    setIsOpen(false);
  };

  const onConfirm = () => {
    startTransition(async () => {
      try {
        const response = await impersonateUser({
          userId: user.id,
        });

        setTokens(response);
      } catch (e) {
        setError(true);
      }
    });
  };

  return (
    <Modal heading={'Impersonate User'} isOpen={isOpen} setIsOpen={onDismiss}>
      <If condition={tokens}>
        {(tokens) => {
          return (
            <>
              <ImpersonateUserAuthSetter tokens={tokens} />

              <PageLoadingIndicator>
                Setting up your session...
              </PageLoadingIndicator>
            </>
          );
        }}
      </If>

      <If condition={error}>
        <Alert type={'error'}>
          <AlertHeading>Impersonation Error</AlertHeading>
          Sorry, something went wrong. Please check the logs.
        </Alert>
      </If>

      <If condition={!error && !tokens}>
        <div className="flex flex-col space-y-6 text-left">
          <div className="flex flex-col space-y-3 text-sm text-muted-foreground">
            <p>
              You are about to impersonate the account belonging to{' '}
              <span className="font-semibold text-foreground">{displayText}</span> (ID{' '}
              <span className="font-mono text-xs text-foreground/80">{user.id}</span>).
            </p>

            <p>
              After impersonating, you will see and perform actions exactly as this user.
              To return to your own account, simply log out.
            </p>

            <p>
              Please use this capability responsibly and only for legitimate support cases.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Modal.CancelButton disabled={pending} onClick={onDismiss}>
              Cancel
            </Modal.CancelButton>

            <Button
              type={'button'}
              loading={pending}
              variant={'destructive'}
              onClick={onConfirm}
            >
              Yes, impersonate user
            </Button>
          </div>
        </div>
      </If>
    </Modal>
  );
}

export default ImpersonateUserConfirmationModal;
