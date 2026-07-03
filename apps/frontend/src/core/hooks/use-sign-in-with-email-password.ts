import { useMutation } from '@tanstack/react-query';
import useSupabase from './use-supabase';

interface Credentials {
  email: string;
  password: string;
}

/**
 * @name useSignInWithEmailPassword
 */
function useSignInWithEmailPassword() {
  const client = useSupabase();

  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      const response = await client.auth.signInWithPassword(credentials);

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
}

export default useSignInWithEmailPassword;