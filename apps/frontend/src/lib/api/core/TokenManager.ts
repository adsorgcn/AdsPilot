/**
 * Token Manager (Singleton)
 * Unified token caching and refresh management for all API clients
 */

import getSupabaseBrowserClient from '~/core/supabase/browser-client';

import type { AuthTokenSource, TokenCacheEntry } from './types';

class TokenManager {
  private static instance: TokenManager;

  private cache: TokenCacheEntry = {
    value: null,
    source: null,
    fetchedAt: 0,
    expiresAt: 0,
  };

  // Refresh token 5 minutes before expiration
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Get cached token or fetch new one
   */
  async getToken(): Promise<{
    token: string | null;
    source: AuthTokenSource;
  }> {
    const now = Date.now();

    // Check if cache is valid
    if (this.isCacheValid(now)) {
      if (process.env.NODE_ENV === 'development') {
        const remainingMin = Math.round(
          (this.cache.expiresAt - now) / 1000 / 60,
        );
        console.log(
          `[TokenManager] Using cached token (expires in ${remainingMin}m)`,
        );
      }

      return {
        token: this.cache.value,
        source: this.cache.source,
      };
    }

    // Fetch new token
    return this.refreshToken(now);
  }

  /**
   * Force refresh token (e.g., after login)
   */
  async refreshToken(now?: number): Promise<{
    token: string | null;
    source: AuthTokenSource;
  }> {
    const currentTime = now ?? Date.now();

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.warn('[TokenManager] Failed to get session:', error.message);
        this.clearCache();
        return { token: null, source: null };
      }

      if (!session?.access_token) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[TokenManager] No active session found');
        }
        this.clearCache();
        return { token: null, source: null };
      }

      // Calculate expiration time
      const expiresAt = session.expires_at
        ? session.expires_at * 1000 // Supabase returns seconds
        : currentTime + 60 * 60 * 1000; // Default: 1 hour

      // Update cache
      this.cache = {
        value: session.access_token,
        source: 'supabase',
        fetchedAt: currentTime,
        expiresAt,
      };

      if (process.env.NODE_ENV === 'development') {
        const expiresInMin = Math.round((expiresAt - currentTime) / 1000 / 60);
        console.log(
          `[TokenManager] Token refreshed, expires in ${expiresInMin}m`,
        );
      }

      return {
        token: session.access_token,
        source: 'supabase',
      };
    } catch (error) {
      console.error('[TokenManager] Failed to refresh token:', error);
      this.clearCache();
      return { token: null, source: null };
    }
  }

  /**
   * Clear token cache (e.g., after logout)
   */
  clearCache(): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TokenManager] Cache cleared');
    }

    this.cache = {
      value: null,
      source: null,
      fetchedAt: 0,
      expiresAt: 0,
    };
  }

  /**
   * Check if cached token is still valid
   */
  private isCacheValid(now: number): boolean {
    return (
      this.cache.value !== null &&
      this.cache.expiresAt > 0 &&
      now < this.cache.expiresAt - this.REFRESH_BUFFER_MS
    );
  }

  /**
   * Get cache info (for debugging)
   */
  getCacheInfo(): {
    hasToken: boolean;
    expiresAt: number;
    expiresIn: number;
    source: AuthTokenSource;
  } {
    const now = Date.now();
    return {
      hasToken: this.cache.value !== null,
      expiresAt: this.cache.expiresAt,
      expiresIn: Math.max(0, this.cache.expiresAt - now),
      source: this.cache.source,
    };
  }
}

export default TokenManager;
