/**
 * Base API Client (Abstract Class)
 * Provides common HTTP methods and error handling for all API clients
 */

import { ApiError } from './errors';
import TokenManager from './TokenManager';
import type { ApiRequestOptions, ApiResponse } from './types';
import { apiMetricsCollector } from '../monitoring/ApiMetrics';
import { globalRequestBatcher } from '../optimization/RequestBatcher';

abstract class BaseApiClient {
  protected readonly baseUrl: string;
  protected readonly tokenManager: TokenManager;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.tokenManager = TokenManager.getInstance();
  }

  /**
   * Build complete URL from endpoint with optional query parameters
   * Can be overridden by subclasses for custom URL resolution
   */
  protected buildUrl(
    endpoint: string,
    params?: Record<string, any>,
  ): string {
    // Handle absolute URLs
    let baseUrl = endpoint;
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      // Handle relative paths
      const base = this.baseUrl.endsWith('/')
        ? this.baseUrl.slice(0, -1)
        : this.baseUrl;
      const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      baseUrl = `${base}${path}`;
    }

    // Add query parameters if provided
    if (params && Object.keys(params).length > 0) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query.append(key, String(value));
        }
      });
      const queryString = query.toString();
      if (queryString) {
        baseUrl += `?${queryString}`;
      }
    }

    return baseUrl;
  }

  /**
   * Build request headers with authentication
   */
  protected async buildHeaders(
    options: ApiRequestOptions,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    // Add authentication headers
    if (options.requireAuth !== false) {
      const { token, source } = await this.tokenManager.getToken();

      if (!token) {
        throw new ApiError(401, 'UNAUTHENTICATED', '尚未登录或会话失效');
      }

      headers.Authorization = `Bearer ${token}`;

      if (source === 'supabase') {
        headers['X-Supabase-Access-Token'] = token;
      }
    }

    return headers;
  }

  /**
   * Core request method
   * Handles the complete request lifecycle with performance monitoring and request batching
   */
  protected async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullUrl = this.buildUrl(endpoint, options.params);

    // 开始性能监控
    apiMetricsCollector.startRequest(requestId, endpoint);

    try {
      const headers = await this.buildHeaders(options);
      const fetchOptions = {
        ...options,
        headers,
        signal: options.signal, // Support request cancellation
      };

      // 使用批处理机制（仅对GET请求启用）
      let response: Response;
      if (options.method === 'GET' || !options.method) {
        response = await globalRequestBatcher.addRequest(
          fullUrl,
          fetchOptions,
          async (url, opts) => fetch(url, opts)
        );
      } else {
        response = await fetch(fullUrl, fetchOptions);
      }

      const result = await this.handleResponse<T>(response);

      // 记录成功指标
      apiMetricsCollector.endRequest(requestId, true, response.status);

      return result;
    } catch (error) {
      // 记录失败指标
      let status = 0;
      let errorType = 'UNKNOWN_ERROR';

      if (error instanceof ApiError) {
        status = error.status;
        errorType = error.code;
      } else if (error instanceof Error && error.name === 'AbortError') {
        errorType = 'REQUEST_CANCELLED';
      }

      apiMetricsCollector.endRequest(requestId, false, status, errorType);

      // Handle specific error types
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(0, 'REQUEST_CANCELLED', '请求已取消');
      }

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        throw ApiError.fromError(error);
      }

      throw new ApiError(0, 'NETWORK_ERROR', '网络请求失败');
    }
  }

  protected async requestRaw(
    endpoint: string,
    options: ApiRequestOptions = {},
  ): Promise<Response> {
    const url = this.buildUrl(endpoint, options.params);
    const headers = await this.buildHeaders(options);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal,
      });

      if (!response.ok) {
        const rawBody = await response.text();
        let payload: unknown = undefined;
        if (rawBody) {
          try {
            payload = JSON.parse(rawBody);
          } catch {
            payload = rawBody;
          }
        }

        throw this.buildErrorFromResponse(
          response.status,
          response.statusText,
          payload,
        );
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(0, 'REQUEST_CANCELLED', '请求已取消');
      }

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        throw ApiError.fromError(error);
      }

      throw new ApiError(0, 'NETWORK_ERROR', '网络请求失败');
    }
  }

  /**
   * Handle and parse response
   */
  protected async handleResponse<T>(response: Response): Promise<T> {
    const rawBody = await response.text();
    let parsed: unknown = undefined;

    // Parse response body
    if (rawBody) {
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        // Not JSON, use raw text
        parsed = rawBody;
      }
    }

    // Handle error responses
    if (!response.ok) {
      throw this.buildErrorFromResponse(
        response.status,
        response.statusText,
        parsed,
      );
    }

    // Handle empty responses
    if (!parsed) {
      return undefined as T;
    }

    // Handle standard API response format
    if (typeof parsed === 'object' && parsed !== null) {
      const payload = parsed as ApiResponse<T> | Record<string, unknown>;

      // Check for standard { success, data, error } format
      if (typeof (payload as ApiResponse<T>).success === 'boolean') {
        const apiPayload = payload as ApiResponse<T>;

        if (apiPayload.success) {
          return (apiPayload.data ?? null) as T;
        }

        // Handle error in standard format
        const errorBlock = apiPayload.error;
        throw new ApiError(
          response.status,
          errorBlock?.code ?? 'API_ERROR',
          errorBlock?.message ?? '接口返回失败',
          errorBlock?.details,
        );
      }

      // Return as-is if not standard format
      return payload as T;
    }

    return parsed as T;
  }

  /**
   * Build ApiError from response
   */
  protected buildErrorFromResponse(
    status: number,
    fallbackMessage: string,
    payload: unknown,
  ): ApiError {
    if (payload && typeof payload === 'object') {
      const data = payload as Record<string, unknown>;

      // Check for nested error object
      const errorBlock = data.error as Record<string, unknown> | undefined;
      if (errorBlock) {
        return new ApiError(
          status,
          (errorBlock.code as string) ?? 'API_ERROR',
          (errorBlock.message as string) ?? fallbackMessage,
          errorBlock.details,
        );
      }

      // Check for top-level error fields
      return new ApiError(
        status,
        (data.code as string) ?? 'API_ERROR',
        (data.message as string) ?? fallbackMessage,
        data.details,
      );
    }

    return new ApiError(status, 'API_ERROR', fallbackMessage);
  }

  /**
   * Convenience method: GET request
   */
  public async get<T>(
    endpoint: string,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * Convenience method: POST request
   */
  public async post<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Convenience method: PUT request
   */
  public async put<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Convenience method: PATCH request
   */
  public async patch<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Convenience method: DELETE request
   */
  public async delete<T>(
    endpoint: string,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

export default BaseApiClient;
