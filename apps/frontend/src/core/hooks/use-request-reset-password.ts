import { useMutation } from '@tanstack/react-query';
import useSupabase from '~/core/hooks/use-supabase';

interface Params {
  email: string;
  redirectTo: string;
}

/**
 * @name useRequestResetPassword
 * @description Requests a password reset for a user. This function will
 * trigger a password reset email to be sent to the user's email address.
 * After the user clicks the link in the email, they will be redirected to
 * /password-reset where their password can be updated.
 */
function useRequestResetPassword() {
  const client = useSupabase();

  const mutation = useMutation({
    mutationKey: ['auth', 'reset-password'],
    mutationFn: async (params: Params) => {
      const result = await client.auth.resetPasswordForEmail(params.email, {
        redirectTo: params.redirectTo,
      });

      if (result.error) {
        throw result.error;
      }

      return result.data;
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}

export default useRequestResetPassword;