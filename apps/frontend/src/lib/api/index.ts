/**
 * API Module - Unified Exports
 *
 * This file provides a single entry point for all API-related functionality.
 * It exports both the new class-based API clients and maintains backward
 * compatibility with the original functional API.
 */

// ==================== Core Exports ====================
export {
  ApiError,
  NetworkError,
  AuthError,
  ValidationError,
  ServerError,
  TimeoutError,
  RateLimitError,
  createApiError,
} from './core/errors';
export { default as TokenManager } from './core/TokenManager';
export type {
  ApiRequestOptions,
  ApiResponse,
  AuthTokenSource,
  TokenCacheEntry,
  PaginatedResponse,
  PaginationParams,
  SortParams,
  SearchParams,
  CommonQueryParams,
} from './core/types';

// ==================== Main API Client ====================
export {
  mainApi,
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
} from './clients/MainApiClient';

// Default export
export { default } from './clients/MainApiClient';

// ==================== Console API Client ====================
export { consoleApi } from './clients/ConsoleApiClient';
export * from './console';

// ==================== Type Exports ====================
export type * from './types/console';

// ==================== SWR Configuration ====================
export {
  queryFetcher as swrFetcher,
  createSmartQueryConfig,
  defaultQueryConfig as swrConfig,
  pollingQueryConfig as swrPollingConfig,
  realtimeQueryConfig as swrRealtimeConfig,
  staticQueryConfig as swrStaticConfig,
} from './swr-config';

// ==================== Utilities ====================
export { default as resolveApiPath } from './resolve-api-path';

// ==================== Hooks ====================
export { useAbortableRequest, useAbortableRequests } from './hooks';
export type { AbortableRequest } from './hooks';
