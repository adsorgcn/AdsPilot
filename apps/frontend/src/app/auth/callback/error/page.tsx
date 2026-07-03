import { redirect } from 'next/navigation';

import { Alert, AlertHeading } from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';
import FadeIn from '~/components/FadeIn';

import ResendLinkForm from './ResendLinkForm';

interface Params {
  searchParams: {
    error: string;
  };
}

function AuthCallbackErrorPage({ searchParams }: Params) {
  const { error } = searchParams;

  // if there is no error, redirect the user to the auth page
  if (!error) {
    redirect('/auth');
  }

  return (
    <FadeIn>
      <div className="flex flex-col items-center space-y-6 py-4 text-center">
        <Alert type={'error'} className="w-full max-w-md text-left">
          <AlertHeading>
            <Trans i18nKey={'auth:authenticationErrorAlertHeading'} />
          </AlertHeading>

          <Trans i18nKey={error} />
        </Alert>

        <ResendLinkForm />

        <Button variant="ghost" href={'/auth'}>
          <Trans i18nKey={'auth:signIn'} />
        </Button>
      </div>
    </FadeIn>
  );
}

export default AuthCallbackErrorPage;
