'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { usePerformanceMetrics } from '~/core/state/GlobalStateProvider';

// API优化配置
interface APIOptimizationConfig {
  // 请求合并
  enableBatching: boolean;
  batchDelay: number; // 批处理延迟（毫秒）
  maxBatchSize: number; // 最大批处理大小

  // 请求去重
  enableDeduplication: boolean;
  deduplicationWindow: number; // 去重时间窗口（毫秒）

  // 响应压缩
  enableCompression: boolean;
  compressionLevel: 'low' | 'medium' | 'high';

  // 缓存策略
  enableResponseCache: boolean;
  defaultCacheTime: number; // 默认缓存时间（秒）

  // 重试机制
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number; // 重试延迟（毫秒）
  retryBackoff: 'linear' | 'exponential';

  // 超时配置
  defaultTimeout: number; // 默认超时时间（毫秒）

  // 优先级队列
  enablePriorityQueue: boolean;

  // 性能监控
  enablePerformanceTracking: boolean;
}

// 默认配置
const DEFAULT_CONFIG: APIOptimizationConfig = {
  enableBatching: true,
  batchDelay: 50,
  maxBatchSize: 10,
  enableDeduplication: true,
  deduplicationWindow: 1000,
  enableCompression: true,
  compressionLevel: 'medium',
  enableResponseCache: true,
  defaultCacheTime: 300, // 5分钟
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoff: 'exponential',
  defaultTimeout: 10000, // 10秒
  enablePriorityQueue: true,
  enablePerformanceTracking: true,
};

// API请求选项
interface APIRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  cache?: boolean | number;
  batchKey?: string;
  deduplicationKey?: string;
  enableCompression?: boolean;
}

// 批处理请求
interface BatchedRequest {
  id: string;
  url: string;
  options: APIRequestOptions;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

// 缓存条目
interface CacheEntry {
  response: Response;
  timestamp: number;
  expiresAt: number;
  etag?: string;
}

// API优化器Hook
export function useAPIOptimizer(customConfig: Partial<APIOptimizationConfig> = {}) {
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...customConfig }), [customConfig]);
  const { recordInteraction, recordApiResponse, recordError } = usePerformanceMetrics();

  // 状态管理
  const [stats, setStats] = useState({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cachedResponses: 0,
    batchedRequests: 0,
    deduplicatedRequests: 0,
    compressedResponses: 0,
    averageResponseTime: 0,
  });

  // 批处理队列
  const batchQueues = useRef<Map<string, BatchedRequest[]>>(new Map());
  const batchTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 去重窗口
  const deduplicationWindow = useRef<Map<string, Promise<Response>>>(new Map());

  // 响应缓存
  const responseCache = useRef<Map<string, CacheEntry>>(new Map());

  // 优先级队列
  const priorityQueue = useRef<Map<string, Array<{
    request: () => Promise<Response>;
    priority: number;
    timestamp: number;
  }>>>(new Map());

  // 生成请求键
  const generateRequestKey = useCallback((
    url: string,
    options: APIRequestOptions
  ): string => {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    const headers = JSON.stringify(options.headers || {});

    return `${method}:${url}:${body}:${headers}`;
  }, []);

  // 生成缓存键
  const generateCacheKey = useCallback((
    url: string,
    options: APIRequestOptions,
    cacheTime?: number
  ): string => {
    const key = generateRequestKey(url, options);
    const ttl = cacheTime ?? config.defaultCacheTime;
    return `${key}:${ttl}`;
  }, [generateRequestKey, config.defaultCacheTime]);

  // 压缩请求体
  const compressBody = useCallback(async (body: any, enableCompression?: boolean): Promise<any> => {
    if (!enableCompression && !config.enableCompression) {
      return body;
    }

    if (typeof body === 'string' && body.length > 1024) {
      // 简单的压缩实现（实际中应该使用专业的压缩库）
      try {
        // 这里可以集成 CompressionStream API 或第三方压缩库
        return body; // 暂时返回原始body
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') console.warn('Compression failed:', error);
        return body;
      }
    }

    return body;
  }, [config.enableCompression]);

  // 执行API请求
  const executeRequest = useCallback(async (
    url: string,
    options: APIRequestOptions = {}
  ): Promise<Response> => {
    const startTime = performance.now();
    const requestId = Math.random().toString(36).substr(2, 9);

    try {
      // 更新统计
      setStats(prev => ({ ...prev, totalRequests: prev.totalRequests + 1 }));

      // 构建请求选项
      const requestOptions: RequestInit = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      };

      // 添加压缩头
      if ((options.enableCompression ?? config.enableCompression)) {
        requestOptions.headers!['Accept-Encoding'] = 'gzip, deflate, br';
      }

      // 压缩请求体
      if (options.body && (options.method !== 'GET' && options.method !== 'HEAD')) {
        requestOptions.body = await compressBody(options.body, options.enableCompression);
      }

      // 设置超时
      const timeout = options.timeout ?? config.defaultTimeout;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      requestOptions.signal = controller.signal;

      // 执行请求
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 更新成功统计
      const responseTime = performance.now() - startTime;
      setStats(prev => {
        const newTotal = prev.successfulRequests + 1;
        const newAverageTime = (prev.averageResponseTime * prev.successfulRequests + responseTime) / newTotal;

        return {
          ...prev,
          successfulRequests: newTotal,
          averageResponseTime: newAverageTime,
        };
      });

      // 记录性能指标
      if (config.enablePerformanceTracking) {
        recordApiResponse('api_request', responseTime);
        recordInteraction('api_request_success', responseTime);
      }

      return response;
    } catch (error) {
      // 更新失败统计
      setStats(prev => ({ ...prev, failedRequests: prev.failedRequests + 1 }));

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      recordError('api_request_failed');

      if (config.enablePerformanceTracking) {
        recordInteraction('api_request_error', performance.now() - startTime);
      }

      throw new Error(`API request failed: ${errorMessage}`);
    }
  }, [config.defaultTimeout, config.enableCompression, config.enablePerformanceTracking, compressBody, recordInteraction, recordApiResponse, recordError]);

  // 带重试的请求
  const requestWithRetry = useCallback(async (
    url: string,
    options: APIRequestOptions = {},
    attempt: number = 1
  ): Promise<Response> => {
    try {
      return await executeRequest(url, options);
    } catch (error) {
      const maxRetries = options.retries ?? config.maxRetries;

      if (attempt <= maxRetries && config.enableRetry) {
        const delay = calculateRetryDelay(attempt, config.retryDelay, config.retryBackoff);

        if (config.enablePerformanceTracking) {
          recordInteraction('api_retry', { attempt, delay });
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        return requestWithRetry(url, options, attempt + 1);
      }

      throw error;
    }
  }, [executeRequest, config.maxRetries, config.enableRetry, config.retryDelay, config.retryBackoff, recordInteraction]);

  // 计算重试延迟
  const calculateRetryDelay = (attempt: number, baseDelay: number, backoff: 'linear' | 'exponential'): number => {
    switch (backoff) {
      case 'linear':
        return baseDelay * attempt;
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      default:
        return baseDelay;
    }
  };

  // 缓存响应
  const getCachedResponse = useCallback((
    url: string,
    options: APIRequestOptions
  ): Response | null => {
    if (!config.enableResponseCache || (options.cache === false)) {
      return null;
    }

    const cacheKey = generateCacheKey(url, options);
    const cached = responseCache.current.get(cacheKey);

    if (!cached) {
      return null;
    }

    // 检查缓存是否过期
    if (Date.now() > cached.expiresAt) {
      responseCache.current.delete(cacheKey);
      return null;
    }

    // 更新缓存统计
    setStats(prev => ({ ...prev, cachedResponses: prev.cachedResponses + 1 }));

    if (config.enablePerformanceTracking) {
      recordInteraction('api_cache_hit');
    }

    return cached.response.clone();
  }, [config.enableResponseCache, generateCacheKey, recordInteraction]);

  // 缓存响应
  const cacheResponse = useCallback((
    url: string,
    options: APIRequestOptions,
    response: Response
  ): void => {
    if (!config.enableResponseCache || (options.cache === false)) {
      return;
    }

    const cacheTime = typeof options.cache === 'number' ? options.cache : config.defaultCacheTime;
    const cacheKey = generateCacheKey(url, options, cacheTime);

    const cacheEntry: CacheEntry = {
      response: response.clone(),
      timestamp: Date.now(),
      expiresAt: Date.now() + (cacheTime * 1000),
      etag: response.headers.get('etag') || undefined,
    };

    responseCache.current.set(cacheKey, cacheEntry);

    // 限制缓存大小
    if (responseCache.current.size > 100) {
      const oldestKey = responseCache.current.keys().next().value;
      if (oldestKey) {
        responseCache.current.delete(oldestKey);
      }
    }
  }, [config.defaultCacheTime, config.enableResponseCache, config.maxCacheSize, generateCacheKey]);

  // 去重处理
  const deduplicateRequest = useCallback((
    url: string,
    options: APIRequestOptions
  ): Promise<Response> | null => {
    if (!config.enableDeduplication) {
      return null;
    }

    const deduplicationKey = options.deduplicationKey || generateRequestKey(url, options);
    const existing = deduplicationWindow.current.get(deduplicationKey);

    if (existing) {
      setStats(prev => ({ ...prev, deduplicatedRequests: prev.deduplicatedRequests + 1 }));

      if (config.enablePerformanceTracking) {
        recordInteraction('api_deduplication');
      }

      return existing;
    }

    return null;
  }, [config.enableDeduplication, generateRequestKey, recordInteraction]);

  // 批处理处理
  const handleBatching = useCallback((
    url: string,
    options: APIRequestOptions
  ): Promise<Response> | null => {
    if (!config.enableBatching || !options.batchKey || options.method !== 'GET') {
      return null;
    }

    return new Promise((resolve, reject) => {
      const batchKey = options.batchKey!;
      const batchedRequest: BatchedRequest = {
        id: Math.random().toString(36).substr(2, 9),
        url,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // 初始化批处理队列
      if (!batchQueues.current.has(batchKey)) {
        batchQueues.current.set(batchKey, []);
      }

      const queue = batchQueues.current.get(batchKey)!;
      queue.push(batchedRequest);

      // 更新批处理统计
      setStats(prev => ({ ...prev, batchedRequests: prev.batchedRequests + 1 }));

      // 设置批处理定时器
      if (!batchTimers.current.has(batchKey)) {
        const timer = setTimeout(() => {
          processBatch(batchKey);
        }, config.batchDelay);

        batchTimers.current.set(batchKey, timer);
      }

      // 检查是否立即处理
      if (queue.length >= config.maxBatchSize) {
        clearTimeout(batchTimers.current.get(batchKey)!);
        batchTimers.current.delete(batchKey);
        processBatch(batchKey);
      }
    });
  }, [config.enableBatching, config.batchDelay, config.maxBatchSize, recordInteraction]);

  // 处理批处理
  const processBatch = useCallback(async (batchKey: string): Promise<void> => {
    const queue = batchQueues.current.get(batchKey);
    if (!queue || queue.length === 0) {
      return;
    }

    batchQueues.current.delete(batchKey);
    batchTimers.current.delete(batchKey);

    try {
      // 构建批处理请求
      const batchRequests = queue.map(req => ({
        id: req.id,
        url: req.url,
        method: req.options.method || 'GET',
        headers: req.options.headers,
      }));

      const batchResponse = await fetch('/api/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: batchRequests,
        }),
      });

      if (!batchResponse.ok) {
        throw new Error(`Batch request failed: ${batchResponse.statusText}`);
      }

      const batchResults = await batchResponse.json();

      // 分发结果
      queue.forEach(request => {
        const result = batchResults.results.find((r: any) => r.id === request.id);
        if (result) {
          if (result.success) {
            request.resolve(new Response(JSON.stringify(result.data), {
              status: result.status,
              headers: result.headers,
            }));
          } else {
            request.reject(new Error(result.error));
          }
        } else {
          request.reject(new Error('No result found for batch request'));
        }
      });

      if (config.enablePerformanceTracking) {
        recordInteraction('api_batch_processed', {
          batchSize: queue.length,
          batchKey
        });
      }
    } catch (error) {
      // 批处理失败，回退到单独请求
      if (process.env.NODE_ENV !== 'production') console.warn('Batch processing failed, falling back to individual requests:', error);

      queue.forEach(async request => {
        try {
          const response = await requestWithRetry(request.url, request.options);
          request.resolve(response);
        } catch (error) {
          request.reject(error instanceof Error ? error : new Error('Unknown error'));
        }
      });
    }
  }, [config.enableCompression, requestWithRetry, recordInteraction]);

  // 主要的优化API请求方法
  const optimizedFetch = useCallback(async (
    url: string,
    options: APIRequestOptions = {}
  ): Promise<Response> => {
    // 1. 检查缓存
    const cachedResponse = getCachedResponse(url, options);
    if (cachedResponse) {
      return cachedResponse;
    }

    // 2. 检查去重
    const deduplicated = deduplicateRequest(url, options);
    if (deduplicated) {
      return deduplicated;
    }

    // 3. 检查批处理
    const batched = handleBatching(url, options);
    if (batched) {
      return batched;
    }

    // 4. 执行单独请求
    const response = await requestWithRetry(url, options);

    // 5. 缓存响应
    cacheResponse(url, options, response);

    return response;
  }, [
    getCachedResponse,
    deduplicateRequest,
    handleBatching,
    requestWithRetry,
    cacheResponse,
  ]);

  // 预加载资源
  const preloadResources = useCallback(async (urls: string[]): Promise<void> => {
    const preloadPromises = urls.map(async (url) => {
      try {
        await optimizedFetch(url, { method: 'HEAD' });
        recordInteraction('api_preload', { url });
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') console.warn(`Failed to preload ${url}:`, error);
      }
    });

    await Promise.all(preloadPromises);
  }, [optimizedFetch, recordInteraction]);

  // 清理缓存
  const clearCache = useCallback((): void => {
    responseCache.current.clear();
    recordInteraction('api_cache_cleared');
  }, [recordInteraction]);

  // 获取详细统计
  const getDetailedStats = useCallback(() => {
    return {
      ...stats,
      cacheSize: responseCache.current.size,
      batchQueueSize: Array.from(batchQueues.current.values()).reduce((sum, queue) => sum + queue.length, 0),
      deduplicationWindowSize: deduplicationWindow.current.size,
      compressionEnabled: config.enableCompression,
      batchingEnabled: config.enableBatching,
      deduplicationEnabled: config.enableDeduplication,
    };
  }, [stats, config.enableCompression, config.enableBatching, config.enableDeduplication]);

  // 定期清理过期缓存和去重窗口
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cleanupInterval = setInterval(() => {
      // 清理过期缓存
      const now = Date.now();
      for (const [key, entry] of responseCache.current.entries()) {
        if (now > entry.expiresAt) {
          responseCache.current.delete(key);
        }
      }

      // 清理过期的去重窗口
      const window = config.deduplicationWindow;
      for (const [key, promise] of deduplicationWindow.current.entries()) {
        // 简化的过期检查（实际中应该记录创建时间）
        setTimeout(() => {
          deduplicationWindow.current.delete(key);
        }, window);
      }
    }, 60000); // 每分钟清理一次

    return () => clearInterval(cleanupInterval);
  }, [config.deduplicationWindow]);

  return {
    // 核心方法
    optimizedFetch,
    preloadResources,
    clearCache,

    // 配置和状态
    config,
    stats,
    getDetailedStats,

    // 工具方法
    generateRequestKey,
    generateCacheKey,
    compressBody,
  };
}

// API优化统计组件
interface APIStatsProps {
  enabled?: boolean;
  className?: string;
}

export function APIStats({ enabled = true, className = '' }: APIStatsProps) {
  const { getDetailedStats } = useAPIOptimizer();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setStats(getDetailedStats());
    }, 2000);

    return () => clearInterval(interval);
  }, [enabled, getDetailedStats]);

  if (!enabled || !stats) {
    return null;
  }

  return (
    <div className={`p-4 bg-white rounded-lg border ${className}`}>
      <h3 className="text-lg font-semibold mb-3">API优化统计</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-600">总请求</p>
          <p className="font-semibold">{stats.totalRequests}</p>
        </div>
        <div>
          <p className="text-gray-600">成功率</p>
          <p className="font-semibold text-green-600">
            {stats.totalRequests > 0 ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1) : 0}%
          </p>
        </div>
        <div>
          <p className="text-gray-600">缓存命中</p>
          <p className="font-semibold text-blue-600">{stats.cachedResponses}</p>
        </div>
        <div>
          <p className="text-gray-600">平均响应</p>
          <p className="font-semibold">{stats.averageResponseTime.toFixed(0)}ms</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-600">批处理</p>
          <p className="font-semibold text-purple-600">{stats.batchedRequests}</p>
        </div>
        <div>
          <p className="text-gray-600">去重</p>
          <p className="font-semibold text-orange-600">{stats.deduplicatedRequests}</p>
        </div>
        <div>
          <p className="text-gray-600">压缩</p>
          <p className="font-semibold text-green-600">{stats.compressedResponses}</p>
        </div>
      </div>
    </div>
  );
}