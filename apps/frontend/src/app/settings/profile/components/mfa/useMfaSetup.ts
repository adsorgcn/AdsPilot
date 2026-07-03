import useSupabase from '~/core/hooks/use-supabase';
import { useMutation } from '@tanstack/react-query';

export function useEnrollFactor() {
  const client = useSupabase();

  return useMutation({
    mutationFn: async (factorName: string) => {
      const { data, error } = await client.auth.mfa.enroll({
        friendlyName: factorName,
        factorType: 'totp',
      });

      if (error) {
        throw error;
      }

      return data;
    },
  });
}

export function useVerifyCodeMutation() {
  const client = useSupabase();

  return useMutation({
      mutationFn: async (arg: { factorId: string; code: string }) => {
        const challenge = await client.auth.mfa.challenge({
          factorId: arg.factorId,
        });

        if (challenge.error) {
          throw challenge.error;
        }

        const challengeId = challenge.data.id;

        const verify = await client.auth.mfa.verify({
          factorId: arg.factorId,
          code: arg.code,
          challengeId,
        });

        if (verify.error) {
          throw verify.error;
        }

        return verify;
      },
    });
}
