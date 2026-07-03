import { useMutation } from '@tanstack/react-query';
import type { UserAttributes } from '@supabase/supabase-js';

import useSupabase from '~/core/hooks/use-supabase';

/**
 * @name useUpdateUserMutation
 */
function useUpdateUserMutation() {
  const client = useSupabase();

  return useMutation({
    mutationFn: async (attributes: UserAttributes & { redirectTo: string }) => {
      const { redirectTo, ...params } = attributes;

      const response = await client.auth.updateUser(params, {
        emailRedirectTo: redirectTo,
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
  });
}

export default useUpdateUserMutation;