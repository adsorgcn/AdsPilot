import { toast } from 'sonner';
import { ZodError } from 'zod';

// API错误类型定义
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  status?: number;
  timestamp?: string;
  requestId?: string;
}

// 预定义的错误类型
export const ERROR_CODES = {
  // 认证错误
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // 请求错误
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_PARAMS: 'INVALID_PARAMS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // 业务逻辑错误
  INSUFFICIENT_TOKENS: 'INSUFFICIENT_TOKENS',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // 系统错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',

  // 资源错误
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // 第三方服务错误
  THIRD_PARTY_ERROR: 'THIRD_PARTY_ERROR',
  OAUTH_ERROR: 'OAUTH_ERROR',
  ADS_API_ERROR: 'ADS_API_ERROR',
} as const;

// 错误消息映射
const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  [ERROR_CODES.UNAUTHORIZED]: {
    title: 'errors.api.unauthorized.title',
    description: 'errors.api.unauthorized.description',
  },
  [ERROR_CODES.FORBIDDEN]: {
    title: 'errors.api.forbidden.title',
    description: 'errors.api.forbidden.description',
  },
  [ERROR_CODES.SESSION_EXPIRED]: {
    title: 'errors.api.sessionExpired.title',
    description: 'errors.api.sessionExpired.description',
  },
  [ERROR_CODES.BAD_REQUEST]: {
    title: 'errors.api.badRequest.title',
    description: 'errors.api.badRequest.description',
  },
  [ERROR_CODES.INVALID_PARAMS]: {
    title: 'errors.api.invalidParams.title',
    description: 'errors.api.invalidParams.description',
  },
  [ERROR_CODES.VALIDATION_ERROR]: {
    title: 'errors.api.validationError.title',
    description: 'errors.api.validationError.description',
  },
  [ERROR_CODES.INSUFFICIENT_TOKENS]: {
    title: 'errors.api.insufficientTokens.title',
    description: 'errors.api.insufficientTokens.description',
  },
  [ERROR_CODES.SUBSCRIPTION_EXPIRED]: {
    title: 'errors.api.subscriptionExpired.title',
    description: 'errors.api.subscriptionExpired.description',
  },
  [ERROR_CODES.RATE_LIMITED]: {
    title: 'errors.api.rateLimited.title',
    description: 'errors.api.rateLimited.description',
  },
  [ERROR_CODES.QUOTA_EXCEEDED]: {
    title: 'errors.api.quotaExceeded.title',
    description: 'errors.api.quotaExceeded.description',
  },
  [ERROR_CODES.INTERNAL_ERROR]: {
    title: 'errors.api.internalError.title',
    description: 'errors.api.internalError.description',
  },
  [ERROR_CODES.SERVICE_UNAVAILABLE]: {
    title: 'errors.api.serviceUnavailable.title',
    description: 'errors.api.serviceUnavailable.description',
  },
  [ERROR_CODES.TIMEOUT]: {
    title: 'errors.api.timeout.title',
    description: 'errors.api.timeout.description',
  },
  [ERROR_CODES.NETWORK_ERROR]: {
    title: 'errors.api.networkError.title',
    description: 'errors.api.networkError.description',
  },
  [ERROR_CODES.NOT_FOUND]: {
    title: 'errors.api.notFound.title',
    description: 'errors.api.notFound.description',
  },
  [ERROR_CODES.ALREADY_EXISTS]: {
    title: 'errors.api.alreadyExists.title',
    description: 'errors.api.alreadyExists.description',
  },
  [ERROR_CODES.CONFLICT]: {
    title: 'errors.api.conflict.title',
    description: 'errors.api.conflict.description',
  },
  [ERROR_CODES.THIRD_PARTY_ERROR]: {
    title: 'errors.api.thirdPartyError.title',
    description: 'errors.api.thirdPartyError.description',
  },
  [ERROR_CODES.OAUTH_ERROR]: {
    title: 'errors.api.oauthError.title',
    description: 'errors.api.oauthError.description',
  },
  [ERROR_CODES.ADS_API_ERROR]: {
    title: 'errors.api.adsApiError.title',
    description: 'errors.api.adsApiError.description',
  },
};

// 错误处理类
export class ApiErrorHandler {
  static parseError(error: unknown): ApiError {
    // 如果已经是API错误格式
    if (this.isApiError(error)) {
      return error;
    }

    // 如果是fetch响应错误
    if (this.isFetchError(error)) {
      return this.parseFetchError(error);
    }

    // 如果是Zod验证错误
    if (error instanceof ZodError) {
      return {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed',
        details: error.errors,
        status: 400,
      };
    }

    // 通用错误处理
    return {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : error,
    };
  }

  private static isApiError(error: any): error is ApiError {
    return error && typeof error === 'object' && 'code' in error && 'message' in error;
  }

  private static isFetchError(error: any): error is Response {
    return error && typeof error === 'object' && 'status' in error && 'ok' in error;
  }

  private static parseFetchError(response: Response): ApiError {
    const status = response.status;

    // 根据HTTP状态码映射错误
    if (status === 401) {
      return {
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Unauthorized access',
        status,
      };
    }

    if (status === 403) {
      return {
        code: ERROR_CODES.FORBIDDEN,
        message: 'Access forbidden',
        status,
      };
    }

    if (status === 404) {
      return {
        code: ERROR_CODES.NOT_FOUND,
        message: 'Resource not found',
        status,
      };
    }

    if (status === 409) {
      return {
        code: ERROR_CODES.CONFLICT,
        message: 'Resource conflict',
        status,
      };
    }

    if (status === 422) {
      return {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation error',
        status,
      };
    }

    if (status === 429) {
      return {
        code: ERROR_CODES.RATE_LIMITED,
        message: 'Rate limit exceeded',
        status,
      };
    }

    if (status >= 500) {
      return {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
        status,
      };
    }

    return {
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Bad request',
      status,
    };
  }

  static handleError(error: ApiError, context?: string) {
    const messageConfig = ERROR_MESSAGES[error.code];

    if (messageConfig) {
      toast.error(messageConfig.title, {
        description: messageConfig.description,
        action: this.getActionForError(error.code),
      });
    } else {
      // 未知错误，显示原始消息
      toast.error(error.message, {
        description: error.details ? JSON.stringify(error.details) : undefined,
      });
    }

    // 特殊错误处理
    if (error.code === ERROR_CODES.UNAUTHORIZED || error.code === ERROR_CODES.SESSION_EXPIRED) {
      // 重定向到登录页面
      this.handleAuthError();
    }

    if (error.code === ERROR_CODES.SUBSCRIPTION_EXPIRED) {
      // 重定向到订阅页面
      this.handleSubscriptionError();
    }

    // 记录错误
    this.logError(error, context);
  }

  private static getActionForError(errorCode: string) {
    switch (errorCode) {
      case ERROR_CODES.UNAUTHORIZED:
        return {
          label: 'errors.api.actions.signIn',
          onClick: () => this.handleAuthError(),
        };
      case ERROR_CODES.SUBSCRIPTION_EXPIRED:
        return {
          label: 'errors.api.actions.upgrade',
          onClick: () => this.handleSubscriptionError(),
        };
      case ERROR_CODES.RATE_LIMITED:
        return {
          label: 'errors.api.actions.retry',
          onClick: () => window.location.reload(),
        };
      default:
        return undefined;
    }
  }

  private static handleAuthError() {
    // 重定向到登录页面
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/signin?redirect=' + encodeURIComponent(window.location.pathname);
    }
  }

  private static handleSubscriptionError() {
    // 重定向到订阅页面
    if (typeof window !== 'undefined') {
      window.location.href = '/billing';
    }
  }

  private static logError(error: ApiError, context?: string) {
    const errorData = {
      ...error,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // 在开发环境下打印到控制台
    if (process.env.NODE_ENV === 'development') {
      console.error('[API Error]', errorData);
    }

    // 在生产环境下发送到错误监控服务
    // TODO: 集成Sentry或其他错误监控服务
  }

  // 重试机制
  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    backoffFactor: number = 2
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries) {
          break;
        }

        // 根据错误类型判断是否应该重试
        if (!this.shouldRetry(error)) {
          break;
        }

        // 计算延迟时间
        const delay = baseDelay * Math.pow(backoffFactor, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private static shouldRetry(error: unknown): boolean {
    const apiError = this.parseError(error);

    // 可重试的错误类型
    const retryableErrors = [
      ERROR_CODES.TIMEOUT,
      ERROR_CODES.NETWORK_ERROR,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      ERROR_CODES.RATE_LIMITED,
    ];

    return retryableErrors.includes(apiError.code as any);
  }
}

// React Hook for error handling
export function useErrorHandler() {
  const handleError = (error: unknown, context?: string) => {
    const apiError = ApiErrorHandler.parseError(error);
    ApiErrorHandler.handleError(apiError, context);
  };

  const retryWithBackoff = <T,>(
    fn: () => Promise<T>,
    options?: { maxRetries?: number; baseDelay?: number; backoffFactor?: number }
  ) => {
    return ApiErrorHandler.retryWithBackoff(
      fn,
      options?.maxRetries,
      options?.baseDelay,
      options?.backoffFactor
    );
  };

  return {
    handleError,
    retryWithBackoff,
    parseError: ApiErrorHandler.parseError,
  };
}