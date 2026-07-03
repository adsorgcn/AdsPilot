'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { usePerformanceMetrics } from '~/core/state/GlobalStateProvider';

// 错误级别
export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

// 错误类型
export type ErrorType =
  | 'javascript'
  | 'network'
  | 'api'
  | 'promise'
  | 'resource'
  | 'security'
  | 'performance'
  | 'user'
  | 'system';

// 错误上下文
interface ErrorContext {
  url: string;
  userAgent: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
  buildVersion: string;
  environment: 'development' | 'staging' | 'production';
  deviceInfo: {
    platform: string;
    vendor: string;
    language: string;
    cookieEnabled: boolean;
    onLine: boolean;
    screen: {
      width: number;
      height: number;
      colorDepth: number;
      pixelDepth: number;
    };
  };
  memoryInfo?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  connectionInfo?: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
}

// 错误详情
interface ErrorDetail {
  id: string;
  level: ErrorLevel;
  type: ErrorType;
  message: string;
  stack?: string;
  source?: {
    filename?: string;
    lineno?: number;
    colno?: number;
    function?: string;
  };
  context: ErrorContext;
  customData?: Record<string, any>;
  fingerprint: string;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  resolved: boolean;
  resolvedAt?: number;
  tags: string[];
}

// 错误监控配置
interface ErrorMonitorConfig {
  // 上报配置
  enableReporting: boolean;
  reportingEndpoint: string;
  apiKey: string;
  batchSize: number;
  flushInterval: number; // 毫秒

  // 错误捕获配置
  captureUnhandledRejections: boolean;
  captureConsoleErrors: boolean;
  captureNetworkErrors: boolean;
  captureResourceErrors: boolean;

  // 采样配置
  sampleRate: number; // 0-1
  errorTypeSampleRates: Record<ErrorType, number>;

  // 过滤配置
  ignoreErrors: RegExp[];
  ignoreUrls: RegExp[];
  ignoreUserAgents: RegExp[];

  // 用户反馈配置
  enableUserFeedback: boolean;
  feedbackPromptDelay: number; // 毫秒

  // 性能影响配置
  maxErrors: number;
  maxContextLength: number;

  // 环境配置
  environment: 'development' | 'staging' | 'production';
  release: string;
  dist: string;
}

// 默认配置
const DEFAULT_CONFIG: ErrorMonitorConfig = {
  enableReporting: process.env.NODE_ENV === 'production',
  reportingEndpoint: '/api/errors',
  apiKey: '',
  batchSize: 10,
  flushInterval: 30000, // 30秒
  captureUnhandledRejections: true,
  captureConsoleErrors: true,
  captureNetworkErrors: true,
  captureResourceErrors: true,
  sampleRate: 1.0,
  errorTypeSampleRates: {
    javascript: 1.0,
    network: 1.0,
    api: 1.0,
    promise: 0.8,
    resource: 0.5,
    security: 1.0,
    performance: 0.3,
    user: 0.2,
    system: 0.1,
  },
  ignoreErrors: [
    /Script error/i,
    /Non-Error promise rejection captured/i,
  ],
  ignoreUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
  ],
  ignoreUserAgents: [
    /bot/i,
    /crawler/i,
    /spider/i,
  ],
  enableUserFeedback: true,
  feedbackPromptDelay: 5000,
  maxErrors: 100,
  maxContextLength: 1000,
  environment: (process.env.NODE_ENV as any) || 'development',
  release: '1.0.0',
  dist: 'web',
};

// 错误监控器Hook
export function useErrorMonitor(customConfig: Partial<ErrorMonitorConfig> = {}) {
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...customConfig }), [customConfig]);
  const { recordInteraction, recordError } = usePerformanceMetrics();

  // 错误状态
  const [errors, setErrors] = useState<ErrorDetail[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sessionId] = useState(() => generateSessionId());

  // 错误队列和批处理
  const errorQueue = useRef<ErrorDetail[]>([]);
  const flushTimer = useRef<NodeJS.Timeout>();

  // 生成会话ID
  function generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 生成错误指纹
  const generateFingerprint = useCallback((error: Partial<ErrorDetail>): string => {
    const fingerprintData = {
      message: error.message,
      type: error.type,
      level: error.level,
      stack: error.stack,
      filename: error.source?.filename,
      function: error.source?.function,
    };

    const fingerprintString = JSON.stringify(fingerprintData);
    return btoa(fingerprintString).substr(0, 16);
  }, []);

  // 获取设备信息
  const getDeviceInfo = useCallback(() => {
    return {
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
      },
    };
  }, []);

  // 获取内存信息
  const getMemoryInfo = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }
    return undefined;
  }, []);

  // 获取连接信息
  const getConnectionInfo = useCallback(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
      };
    }
    return undefined;
  }, []);

  // 创建错误上下文
  const createErrorContext = useCallback((): ErrorContext => {
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      sessionId,
      buildVersion: config.release,
      environment: config.environment,
      deviceInfo: getDeviceInfo(),
      memoryInfo: getMemoryInfo(),
      connectionInfo: getConnectionInfo(),
    };
  }, [config, sessionId, getDeviceInfo, getMemoryInfo, getConnectionInfo]);

  // 创建错误详情
  const createErrorDetail = useCallback((
    level: ErrorLevel,
    type: ErrorType,
    message: string,
    error?: Error,
    source?: any,
    customData?: Record<string, any>
  ): ErrorDetail => {
    const context = createErrorContext();
    const fingerprint = generateFingerprint({
      level,
      type,
      message,
      stack: error?.stack,
      source: source ? {
        filename: source.filename,
        lineno: source.lineno,
        colno: source.colno,
        function: source.function,
      } : undefined,
    });

    return {
      id: Math.random().toString(36).substr(2, 9),
      level,
      type,
      message,
      stack: error?.stack,
      source: source ? {
        filename: source.filename,
        lineno: source.lineno,
        colno: source.colno,
        function: source.function,
      } : undefined,
      context,
      customData,
      fingerprint,
      occurrences: 1,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      resolved: false,
      tags: [],
    };
  }, [createErrorContext, generateFingerprint]);

  // 检查是否应该忽略错误
  const shouldIgnoreError = useCallback((error: Partial<ErrorDetail>): boolean => {
    // 检查采样率
    const sampleRate = config.errorTypeSampleRates[error.type!] || config.sampleRate;
    if (Math.random() > sampleRate) {
      return true;
    }

    // 检查忽略列表
    if (error.message && config.ignoreErrors.some(pattern => pattern.test(error.message))) {
      return true;
    }

    if (error.context?.url && config.ignoreUrls.some(pattern => pattern.test(error.context.url))) {
      return true;
    }

    if (error.context?.userAgent && config.ignoreUserAgents.some(pattern => pattern.test(error.context.userAgent))) {
      return true;
    }

    return false;
  }, [config]);

  // 上报错误（移到前面避免循环依赖）
  const flushErrors = useCallback(async () => {
    if (errorQueue.current.length === 0 || !config.enableReporting) {
      return;
    }

    const errorsToReport = errorQueue.current.splice(0, config.batchSize);
    errorQueue.current = errorQueue.current.slice(config.batchSize);

    // 清除定时器
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = undefined;
    }

    try {
      const response = await fetch(config.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
        body: JSON.stringify({
          errors: errorsToReport,
          meta: {
            release: config.release,
            environment: config.environment,
            dist: config.dist,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Error reporting failed: ${response.statusText}`);
      }

      recordInteraction('errors_reported', { count: errorsToReport.length });
    } catch (error) {
      console.error('Failed to report errors:', error);
      // 将失败的错误重新加入队列
      errorQueue.current.unshift(...errorsToReport);
    }
  }, [config, recordInteraction]);

  // 显示用户反馈（移到前面避免循环依赖）
  const showUserFeedback = useCallback((error: ErrorDetail) => {
    // 这里可以实现用户反馈UI
    console.log('User feedback requested for error:', error.id);
    recordInteraction('user_feedback_requested', { errorId: error.id });
  }, [recordInteraction]);

  // 处理错误
  const handleError = useCallback((
    level: ErrorLevel,
    type: ErrorType,
    message: string,
    error?: Error,
    source?: any,
    customData?: Record<string, any>
  ) => {
    const errorDetail = createErrorDetail(level, type, message, error, source, customData);

    // 检查是否应该忽略
    if (shouldIgnoreError(errorDetail)) {
      return;
    }

    // 检查错误数量限制
    if (errors.length >= config.maxErrors) {
      console.warn('Error limit reached, dropping new error');
      return;
    }

    // 检查是否是重复错误
    const existingError = errors.find(e => e.fingerprint === errorDetail.fingerprint);
    if (existingError) {
      // 更新现有错误
      setErrors(prev => prev.map(e =>
        e.fingerprint === errorDetail.fingerprint
          ? {
              ...e,
              occurrences: e.occurrences + 1,
              lastSeen: Date.now(),
            }
          : e
      ));
      return;
    }

    // 添加新错误
    setErrors(prev => [...prev, errorDetail]);

    // 添加到上报队列
    if (config.enableReporting) {
      errorQueue.current.push(errorDetail);

      // 检查是否需要立即上报
      if (errorQueue.current.length >= config.batchSize) {
        flushErrors();
      } else if (!flushTimer.current) {
        flushTimer.current = setTimeout(() => {
          flushErrors();
        }, config.flushInterval);
      }
    }

    // 记录性能指标
    recordError('error_occurred', {
      type,
      level,
      message: message.substring(0, 100),
    });

    // 显示用户反馈提示（仅在生产环境）
    if (config.enableUserFeedback && config.environment === 'production' && level === 'fatal') {
      setTimeout(() => {
        showUserFeedback(errorDetail);
      }, config.feedbackPromptDelay);
    }
  }, [
    createErrorDetail,
    shouldIgnoreError,
    errors,
    config,
    recordError,
    flushErrors,
    showUserFeedback,
  ]);

  // JavaScript错误处理
  const handleJavaScriptError = useCallback((event: ErrorEvent) => {
    handleError(
      'error',
      'javascript',
      event.message || 'Unknown JavaScript error',
      event.error,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }
    );
  }, [handleError]);

  // Promise错误处理
  const handleUnhandledRejection = useCallback((event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);

    handleError(
      'error',
      'promise',
      `Unhandled promise rejection: ${message}`,
      reason instanceof Error ? reason : new Error(message)
    );
  }, [handleError]);

  // 网络错误处理
  const handleNetworkError = useCallback((event: Event) => {
    const target = event.target as any;

    handleError(
      'error',
      'network',
      `Network error: ${target.tagName || 'Unknown'}`,
      new Error(`Failed to load ${target.src || target.href}`),
      {
        filename: target.src || target.href,
        element: target.tagName,
      }
    );
  }, [handleError]);

  // 手动报告错误
  const reportError = useCallback((
    message: string,
    level: ErrorLevel = 'error',
    type: ErrorType = 'user',
    customData?: Record<string, any>
  ) => {
    handleError(level, type, message, undefined, undefined, customData);
  }, [handleError]);

  // 解决错误
  const resolveError = useCallback((errorId: string) => {
    setErrors(prev => prev.map(e =>
      e.id === errorId
        ? { ...e, resolved: true, resolvedAt: Date.now() }
        : e
    ));
    recordInteraction('error_resolved', { errorId });
  }, [recordInteraction]);

  // 清除错误
  const clearErrors = useCallback(() => {
    setErrors([]);
    errorQueue.current = [];
    recordInteraction('errors_cleared');
  }, [recordInteraction]);

  // 设置全局错误监听器
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // JavaScript错误
    window.addEventListener('error', handleJavaScriptError);

    // Promise错误
    if (config.captureUnhandledRejections) {
      window.addEventListener('unhandledrejection', handleUnhandledRejection);
    }

    // 网络错误
    if (config.captureNetworkErrors) {
      window.addEventListener('error', handleNetworkError, true);
    }

    // 在线状态监听
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      handleError('warning', 'network', 'Network connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('error', handleJavaScriptError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleNetworkError, true);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [config, handleJavaScriptError, handleUnhandledRejection, handleNetworkError, handleError]);

  // 页面卸载时上报剩余错误
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushErrors();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushErrors]);

  // 获取错误统计
  const getErrorStats = useCallback(() => {
    const stats = {
      total: errors.length,
      byLevel: {
        fatal: errors.filter(e => e.level === 'fatal').length,
        error: errors.filter(e => e.level === 'error').length,
        warning: errors.filter(e => e.level === 'warning').length,
        info: errors.filter(e => e.level === 'info').length,
        debug: errors.filter(e => e.level === 'debug').length,
      },
      byType: {
        javascript: errors.filter(e => e.type === 'javascript').length,
        network: errors.filter(e => e.type === 'network').length,
        api: errors.filter(e => e.type === 'api').length,
        promise: errors.filter(e => e.type === 'promise').length,
        resource: errors.filter(e => e.type === 'resource').length,
        security: errors.filter(e => e.type === 'security').length,
        performance: errors.filter(e => e.type === 'performance').length,
        user: errors.filter(e => e.type === 'user').length,
        system: errors.filter(e => e.type === 'system').length,
      },
      resolved: errors.filter(e => e.resolved).length,
      unresolved: errors.filter(e => !e.resolved).length,
      queueSize: errorQueue.current.length,
    };

    return stats;
  }, [errors]);

  return {
    // 错误数据
    errors,
    isOnline,
    sessionId,

    // 错误操作
    reportError,
    resolveError,
    clearErrors,

    // 统计和状态
    getErrorStats,
    config,
  };
}

// 错误监控面板组件
interface ErrorMonitorPanelProps {
  enabled?: boolean;
  className?: string;
  maxErrors?: number;
}

export function ErrorMonitorPanel({
  enabled = process.env.NODE_ENV === 'development',
  className = '',
  maxErrors = 10
}: ErrorMonitorPanelProps) {
  const { errors, getErrorStats, resolveError, clearErrors } = useErrorMonitor();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setStats(getErrorStats());
    }, 2000);

    return () => clearInterval(interval);
  }, [enabled, getErrorStats]);

  if (!enabled || !stats) {
    return null;
  }

  const displayErrors = errors.slice(0, maxErrors);

  return (
    <div className={`p-4 bg-white rounded-lg border ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">错误监控</h3>
        <div className="flex space-x-2">
          <button
            onClick={clearErrors}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            清除
          </button>
          <div className={`w-3 h-3 rounded-full ${stats.unresolved > 0 ? 'bg-red-500' : 'bg-green-500'}`} />
        </div>
      </div>

      {/* 错误统计 */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <p className="text-gray-600">总错误</p>
          <p className="font-semibold">{stats.total}</p>
        </div>
        <div>
          <p className="text-gray-600">未解决</p>
          <p className="font-semibold text-red-600">{stats.unresolved}</p>
        </div>
        <div>
          <p className="text-gray-600">队列</p>
          <p className="font-semibold">{stats.queueSize}</p>
        </div>
      </div>

      {/* 按级别统计 */}
      <div className="grid grid-cols-5 gap-2 mb-4 text-xs">
        <div className="text-center">
          <p className="text-red-600 font-semibold">{stats.byLevel.fatal}</p>
          <p className="text-gray-600">致命</p>
        </div>
        <div className="text-center">
          <p className="text-orange-600 font-semibold">{stats.byLevel.error}</p>
          <p className="text-gray-600">错误</p>
        </div>
        <div className="text-center">
          <p className="text-yellow-600 font-semibold">{stats.byLevel.warning}</p>
          <p className="text-gray-600">警告</p>
        </div>
        <div className="text-center">
          <p className="text-blue-600 font-semibold">{stats.byLevel.info}</p>
          <p className="text-gray-600">信息</p>
        </div>
        <div className="text-center">
          <p className="text-gray-600 font-semibold">{stats.byLevel.debug}</p>
          <p className="text-gray-600">调试</p>
        </div>
      </div>

      {/* 错误列表 */}
      {displayErrors.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {displayErrors.map((error) => (
            <div key={error.id} className="p-2 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {error.message}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-1 text-xs rounded ${
                      error.level === 'fatal' ? 'bg-red-100 text-red-800' :
                      error.level === 'error' ? 'bg-orange-100 text-orange-800' :
                      error.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      error.level === 'info' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {error.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(error.lastSeen).toLocaleTimeString()}
                    </span>
                    {error.occurrences > 1 && (
                      <span className="text-xs text-gray-500">
                        x{error.occurrences}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => resolveError(error.id)}
                  className="ml-2 p-1 text-green-600 hover:bg-green-100 rounded"
                  title="解决错误"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {errors.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          暂无错误记录
        </div>
      )}
    </div>
  );
}