import { useQuery } from '@tanstack/react-query';

import useSupabase from '~/core/hooks/use-supabase';
import useFactorsMutationKey from '~/core/hooks/use-user-factors-mutation-key';

function useFetchAuthFactors() {
  const client = useSupabase();
  const key = useFactorsMutationKey();

  const query = useQuery({
    queryKey: [key],
    queryFn: async () => {
      const { data, error } = await client.auth.mfa.listFactors();

      if (error) {
        throw error;
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - MFA factors don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export default useFetchAuthFactors;