import { useMutation } from '@tanstack/react-query';

import type {
  AuthError,
  SignInWithPasswordlessCredentials,
} from '@supabase/supabase-js';

import useSupabase from '~/core/hooks/use-supabase';
import configuration from '~/configuration';

/**
 * @name useSignInWithOtp
 */
function useSignInWithOtp() {
  const client = useSupabase();

  return useMutation({
    mutationFn: async (credentials: SignInWithPasswordlessCredentials) => {
      const result = await client.auth.signInWithOtp(credentials);

      if (result.error) {
        if (shouldIgnoreError(result.error)) {
          console.warn(
            `Ignoring error during development: ${result.error.message}`,
          );

          return {} as never;
        }

        throw result.error.message;
      }

      return result.data;
    },
  });
}

export default useSignInWithOtp;

function shouldIgnoreError(error: AuthError) {
  return !configuration.production && isSmsProviderNotSetupError(error);
}

function isSmsProviderNotSetupError(error: AuthError) {
  return (
    error.message === `Error sending sms: sms Provider  could not be found`
  );
}
