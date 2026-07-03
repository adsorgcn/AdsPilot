'use client';

import { useMutation } from '@tanstack/react-query';

import Trans from '~/core/ui/Trans';
import Button from '~/core/ui/Button';
import useSupabase from '~/core/hooks/use-supabase';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';
import Alert from '~/core/ui/Alert';

function ResendLinkForm() {
  const resendLink = useResendLink();

  if (resendLink.data && !resendLink.isPending) {
    return (
      <Alert type={'success'} className="w-full max-w-sm text-left">
        <Trans i18nKey={'auth:resendLinkSuccess'} defaults={'Success!'} />
      </Alert>
    );
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col space-y-3 text-left"
      onSubmit={(data) => {
        data.preventDefault();

        const email = new FormData(data.currentTarget).get('email') as string;

        resendLink.mutate(email);
      }}
    >
      <TextFieldLabel>
        <Trans i18nKey={'common:emailAddress'} />
        <TextFieldInput name={'email'} required placeholder={''} />
      </TextFieldLabel>

      <Button loading={resendLink.isPending}>
        <Trans i18nKey={'auth:resendLink'} defaults={'Resend Link'} />
      </Button>
    </form>
  );
}

export default ResendLinkForm;

function useResendLink() {
  const supabase = useSupabase();

  return useMutation({
    mutationFn: async (email: string) => {
      const response = await supabase.auth.resend({
        email,
        type: 'signup',
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
  });
}
