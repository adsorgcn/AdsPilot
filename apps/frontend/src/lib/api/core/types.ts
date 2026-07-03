/**
 * Core API Types
 * Shared type definitions for all API clients
 */

/**
 * API Request Options
 */
export interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean;
  headers?: HeadersInit;
  params?: Record<string, any>; // Query parameters
  signal?: AbortSignal; // Request cancellation support
}

/**
 * Standard API Response Format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

/**
 * Authentication Token Source
 */
export type AuthTokenSource = 'supabase' | null;

/**
 * Token Cache Entry
 */
export interface TokenCacheEntry {
  value: string | null;
  source: AuthTokenSource;
  fetchedAt: number;
  expiresAt: number;
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Pagination Params
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  pageSize?: number; // Alias for limit
}

/**
 * Sort Params
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search Params
 */
export interface SearchParams {
  search?: string;
  q?: string; // Alias for search
}

/**
 * Common Query Params
 */
export type CommonQueryParams = PaginationParams & SortParams & SearchParams;
