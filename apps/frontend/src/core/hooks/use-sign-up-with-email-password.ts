import { useMutation } from '@tanstack/react-query';
import useSupabase from './use-supabase';
import configuration from '~/configuration';

interface Credentials {
  email: string;
  password: string;
}

/**
 * @name useSignUpWithEmailAndPassword
 */
function useSignUpWithEmailAndPassword() {
  const client = useSupabase();

  const mutation = useMutation({
    mutationKey: ['auth', 'sign-up-with-email-password'],
    mutationFn: async (credentials: Credentials) => {
      const emailRedirectTo = getRedirectUrl();

      const response = await client.auth.signUp({
        ...credentials,
        options: {
          emailRedirectTo,
        },
      });

      if (response.error) {
        throw response.error.message;
      }

      const user = response.data?.user;
      const identities = user?.identities ?? [];

      // if the user has no identities, it means that the email is taken
      if (identities.length === 0) {
        throw new Error('User already registered');
      }

      return response.data;
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

export default useSignUpWithEmailAndPassword;

function getRedirectUrl() {
  const nextPath = configuration.paths.appHome;
  const callbackPath = configuration.paths.authCallback;
  const fullPath = `${callbackPath}?next=${nextPath}`;

  return new URL(fullPath, window.location.origin).href;
}