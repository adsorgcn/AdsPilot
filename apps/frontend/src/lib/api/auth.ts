/**
 * Authentication API utilities
 */

import { createClient } from '@supabase/supabase-js';
import type { AuthError } from '@supabase/supabase-js';

// Supabase客户端配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 创建Supabase客户端实例
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Create authenticated request headers
 */
export async function createAuthenticatedRequest(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Failed to get auth session: ${error.message}`);
  }

  if (!session?.access_token) {
    throw new Error('No active session found');
  }

  return session.access_token;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();

  return !!session?.access_token;
}

/**
 * Get current user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();

  return session?.user?.id || null;
}