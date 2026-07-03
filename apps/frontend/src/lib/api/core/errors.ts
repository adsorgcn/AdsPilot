/**
 * API Error Class
 * Unified error handling for all API clients
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Check if error is authentication related
   */
  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /**
   * Check if error is client-side (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is server-side (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Check if error is network related
   */
  isNetworkError(): boolean {
    return this.status === 0;
  }

  /**
   * Get user-friendly error message based on status code
   */
  getUserMessage(): string {
    // Check specific status codes first
    const specificMessage = getUserFriendlyMessage(this.status);
    if (specificMessage) {
      return specificMessage;
    }

    // Fallback to category-based messages
    if (this.isAuthError()) {
      return '登录已过期，请重新登录';
    }

    if (this.isNetworkError()) {
      return '网络连接失败，请检查网络设置';
    }

    if (this.isServerError()) {
      return '服务器错误，请稍后重试';
    }

    if (this.isClientError()) {
      return '请求参数有误，请检查后重试';
    }

    return this.message || '请求失败，请重试';
  }

  /**
   * Check if error is a request cancellation
   */
  isCancelled(): boolean {
    return this.code === 'REQUEST_CANCELLED';
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    // Don't retry auth errors, client errors, or cancelled requests
    if (this.isAuthError() || this.isCancelled()) {
      return false;
    }

    // Don't retry most client errors (4xx)
    if (this.isClientError() && this.status !== 408 && this.status !== 429) {
      return false;
    }

    // Retry server errors and network errors
    return this.isServerError() || this.isNetworkError() || this.status === 408 || this.status === 429;
  }

  /**
   * Create ApiError from standard Error
   */
  static fromError(error: Error, status = 0): ApiError {
    return new ApiError(status, 'UNKNOWN_ERROR', error.message);
  }

  /**
   * Create ApiError from fetch Response
   */
  static async fromResponse(response: Response): Promise<ApiError> {
    let message = response.statusText;
    let code = 'API_ERROR';
    let details: unknown = undefined;

    try {
      const body = await response.json();
      if (body.error) {
        code = body.error.code || code;
        message = body.error.message || message;
        details = body.error.details;
      } else if (body.message) {
        message = body.message;
        code = body.code || code;
      }
    } catch {
      // Response is not JSON, use statusText
    }

    return new ApiError(response.status, code, message, details);
  }
}

/**
 * Network Error - Connection failed
 */
export class NetworkError extends ApiError {
  constructor(message = '网络连接失败') {
    super(0, 'NETWORK_ERROR', message);
    this.name = 'NetworkError';
  }
}

/**
 * Authentication Error - 401/403
 */
export class AuthError extends ApiError {
  constructor(status: number, message = '认证失败') {
    super(status, 'AUTH_ERROR', message);
    this.name = 'AuthError';
  }
}

/**
 * Validation Error - 400/422
 */
export class ValidationError extends ApiError {
  constructor(status: number, message = '请求参数有误', details?: unknown) {
    super(status, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Server Error - 5xx
 */
export class ServerError extends ApiError {
  constructor(status: number, message = '服务器错误') {
    super(status, 'SERVER_ERROR', message);
    this.name = 'ServerError';
  }
}

/**
 * Request Timeout Error - 408
 */
export class TimeoutError extends ApiError {
  constructor(message = '请求超时') {
    super(408, 'TIMEOUT_ERROR', message);
    this.name = 'TimeoutError';
  }
}

/**
 * Rate Limit Error - 429
 */
export class RateLimitError extends ApiError {
  constructor(message = '请求过于频繁，请稍后再试') {
    super(429, 'RATE_LIMIT_ERROR', message);
    this.name = 'RateLimitError';
  }
}

/**
 * Get user-friendly error message for specific HTTP status codes
 */
function getUserFriendlyMessage(status: number): string | null {
  const messages: Record<number, string> = {
    // Client errors (4xx)
    400: '请求参数有误',
    401: '请先登录',
    403: '没有权限执行此操作',
    404: '请求的资源不存在',
    405: '不支持的操作',
    408: '请求超时，请重试',
    409: '操作冲突，请刷新后重试',
    410: '请求的资源已被删除',
    422: '提交的数据验证失败',
    429: '请求过于频繁，请稍后再试',

    // Server errors (5xx)
    500: '服务器错误，我们已收到通知',
    501: '功能暂未实现',
    502: '服务暂时不可用',
    503: '服务维护中',
    504: '服务器响应超时',
  };

  return messages[status] ?? null;
}

/**
 * Create appropriate error subclass based on status code
 */
export function createApiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): ApiError {
  // Network error
  if (status === 0) {
    return new NetworkError(message);
  }

  // Authentication error
  if (status === 401 || status === 403) {
    return new AuthError(status, message);
  }

  // Validation error
  if (status === 400 || status === 422) {
    return new ValidationError(status, message, details);
  }

  // Timeout error
  if (status === 408) {
    return new TimeoutError(message);
  }

  // Rate limit error
  if (status === 429) {
    return new RateLimitError(message);
  }

  // Server error
  if (status >= 500) {
    return new ServerError(status, message);
  }

  // Generic API error
  return new ApiError(status, code, message, details);
}
