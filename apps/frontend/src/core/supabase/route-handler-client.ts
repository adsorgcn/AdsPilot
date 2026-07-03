import 'server-only';

import { CookieOptions, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

import { Database, SupabaseClientInstance } from '~/database.types';
import getSupabaseClientKeys from './get-supabase-client-keys';

/**
 * @name getSupabaseRouteHandlerClient
 * @description Get a Supabase client for use in the Route Handler Routes
 * @param params
 */
const getSupabaseRouteHandlerClient = (
  params = {
    admin: false,
  },
): SupabaseClientInstance => {
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

  return createServerClient<Database>(keys.url, keys.anonKey, {
    cookies: getCookiesStrategy(),
  }) as SupabaseClientInstance;
};

export default getSupabaseRouteHandlerClient;

function getCookiesStrategy() {
  const cookieStore = cookies();

  return {
    set: (name: string, value: string, options: CookieOptions) => {
      cookieStore.set({ name, value, ...options });
    },
    get: (name: string) => {
      return cookieStore.get(name)?.value;
    },
    remove: (name: string, options: CookieOptions) => {
      cookieStore.set({ name, value: '', ...options });
    },
  };
}
