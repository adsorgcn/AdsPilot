/**
 * Main API Client
 * Replaces the functional API in api/client.ts with a class-based approach
 */

import BaseApiClient from '../core/BaseApiClient';
import resolveApiPath from '../resolve-api-path';
import type { ApiRequestOptions } from '../core/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// Environment variable validation (browser only)
if (!API_BASE_URL && typeof window !== 'undefined') {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.NODE_ENV !== 'production') console.error(
      '[MainApiClient] CRITICAL: NEXT_PUBLIC_API_BASE_URL 未配置！' +
        'API 请求可能失败。请联系管理员。',
    );
  } else if (process.env.NODE_ENV !== 'test') {
    if (process.env.NODE_ENV !== 'production') console.warn(
      '[MainApiClient] WARNING: NEXT_PUBLIC_API_BASE_URL 未配置。' +
        '将直接使用传入路径，这可能导致请求失败。',
    );
  }
}

class MainApiClient extends BaseApiClient {
  constructor() {
    super(API_BASE_URL);
  }

  /**
   * Override buildUrl to use resolveApiPath logic
   * This maintains compatibility with the original client.ts behavior
   */
  protected buildUrl(endpoint: string): string {
    return resolveApiPath(endpoint);
  }

  /**
   * Public GET method
   */
  async get<T>(
    endpoint: string,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return super.get<T>(endpoint, options);
  }

  /**
   * Public POST method
   */
  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return super.post<T>(endpoint, body, options);
  }

  /**
   * Public PUT method
   */
  async put<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return super.put<T>(endpoint, body, options);
  }

  /**
   * Public PATCH method
   */
  async patch<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return super.patch<T>(endpoint, body, options);
  }

  /**
   * Public DELETE method
   */
  async delete<T>(
    endpoint: string,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return super.delete<T>(endpoint, options);
  }

  /**
   * Generic request method (for advanced usage)
   */
  async request<T>(
    endpoint: string,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return super.request<T>(endpoint, options);
  }

  async requestRaw(
    endpoint: string,
    options?: ApiRequestOptions,
  ): Promise<Response> {
    return super.requestRaw(endpoint, options);
  }
}

// Singleton instance
export const mainApi = new MainApiClient();

// ==================== Backward Compatibility API ====================
// Export functional API to maintain compatibility with existing code

/**
 * @deprecated Use mainApi.request() instead
 */
export const apiRequest = <T>(
  endpoint: string,
  options?: ApiRequestOptions,
): Promise<T> => mainApi.request<T>(endpoint, options);

/**
 * @deprecated Use mainApi.get() instead
 */
export const apiGet = <T>(
  endpoint: string,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> => mainApi.get<T>(endpoint, options);

/**
 * @deprecated Use mainApi.post() instead
 */
export const apiPost = <T>(
  endpoint: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> => mainApi.post<T>(endpoint, body, options);

/**
 * @deprecated Use mainApi.put() instead
 */
export const apiPut = <T>(
  endpoint: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> => mainApi.put<T>(endpoint, body, options);

/**
 * @deprecated Use mainApi.patch() instead
 */
export const apiPatch = <T>(
  endpoint: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> => mainApi.patch<T>(endpoint, body, options);

/**
 * @deprecated Use mainApi.delete() instead
 */
export const apiDelete = <T>(
  endpoint: string,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> => mainApi.delete<T>(endpoint, options);

// Default export for convenience
export default mainApi;
