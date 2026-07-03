import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import getSupabaseClientKeys from '~/core/supabase/get-supabase-client-keys';
import { Database, SupabaseClientInstance } from '~/database.types';
import { createClient } from '@supabase/supabase-js';

/**
 * @name getSupabaseServerComponentClient
 * @description Get a Supabase client for use in the Server Components
 * @param params
 */
const getSupabaseServerComponentClient = async (
  params = {
    admin: false,
  },
): Promise<SupabaseClientInstance> => {
  const keys = getSupabaseClientKeys();

  if (params.admin) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      throw new Error('Supabase Service Role Key not provided');
    }

    return createClient<Database>(keys.url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }) as SupabaseClientInstance;
  }

  const cookiesStrategy = await getCookiesStrategy();
  
  return createServerClient<Database>(keys.url, keys.anonKey, {
    cookies: cookiesStrategy,
  }) as SupabaseClientInstance;
};

export default getSupabaseServerComponentClient;

async function getCookiesStrategy() {
  const cookieStore = await cookies();

  return {
    get: (name: string) => {
      return cookieStore.get(name)?.value;
    },
  };
}
