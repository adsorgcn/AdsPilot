import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import useSupabase from '~/core/hooks/use-supabase';
import useUserSession from '~/core/hooks/use-user-session';

/**
 * @name useRequireAuth
 * @description Hook that ensures user is authenticated and redirects to sign-in if not
 */
export function useRequireAuth() {
  const router = useRouter();
  const client = useSupabase();
  const userSession = useUserSession();

  useEffect(() => {
    if (!userSession) {
      router.push('/auth');
    }
  }, [userSession, router]);

  // Return a user object with getIdToken method for API calls
  if (!userSession) {
    return null;
  }

  return {
    ...userSession,
    getIdToken: async () => {
      const { data } = await client.auth.getSession();
      return data.session?.access_token || null;
    },
  };
}
