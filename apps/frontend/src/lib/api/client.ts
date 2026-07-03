/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please import from '~/lib/api' instead.
 *
 * Migration guide:
 * - import { apiGet } from '~/lib/api' → import { apiGet } from '~/lib/api'
 * - import { ApiError } from '~/lib/api' → import { ApiError } from '~/lib/api'
 *
 * This file now re-exports from the new unified API client for backward compatibility.
 */

// Re-export everything from the new API structure
export { ApiError } from './core/errors';

export {
  mainApi,
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
} from './clients/MainApiClient';

export type {
  ApiRequestOptions,
  ApiResponse,
} from './core/types';

// For direct usage (e.g., hooks that need the client instance)
export { default } from './clients/MainApiClient';
