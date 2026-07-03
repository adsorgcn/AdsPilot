import { useMutation } from '@tanstack/react-query';
import useSupabase from '~/core/hooks/use-supabase';
import type { VerifyOtpParams } from '@supabase/supabase-js';

/**
 * @name useVerifyOtp
 * @description Verify the OTP sent to the user's phone number
 */
function useVerifyOtp() {
  const client = useSupabase();

  return useMutation({
    mutationFn: async (arg: VerifyOtpParams) => {
      const { data, error } = await client.auth.verifyOtp(arg);

      if (error) {
        throw error;
      }

      return data;
    },
  });
}

export default useVerifyOtp;
