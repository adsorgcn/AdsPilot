import type { SignInWithOAuthCredentials } from '@supabase/supabase-js';
import { useMutation } from '@tanstack/react-query';
import useSupabase from '~/core/hooks/use-supabase';

/**
 * @name useSignInWithProvider
 */
function useSignInWithProvider() {
  const client = useSupabase();

  return useMutation({
    mutationFn: async (credentials: SignInWithOAuthCredentials) => {
      const response = await client.auth.signInWithOAuth(credentials);

      if (response.error) {
        throw response.error.message;
      }

      return response.data;
    },
  });
}

export default useSignInWithProvider;