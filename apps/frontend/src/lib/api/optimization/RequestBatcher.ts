/**
 * 请求批处理和合并机制
 *
 * 智能识别和合并重复的API请求，减少网络开销
 */

interface PendingRequest {
  id: string;
  endpoint: string;
  options: RequestInit;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

interface BatchConfig {
  /** 批处理窗口时间（毫秒） */
  windowMs: number;
  /** 最大批处理请求数 */
  maxBatchSize: number;
  /** 是否启用批处理 */
  enabled: boolean;
}

export class RequestBatcher {
  private pendingRequests = new Map<string, PendingRequest[]>();
  private batchTimers = new Map<string, NodeJS.Timeout>();
  private config: BatchConfig;
  private metrics = {
    totalRequests: 0,
    batchedRequests: 0,
    mergedRequests: 0,
  };

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      windowMs: 50, // 50ms窗口
      maxBatchSize: 10,
      enabled: true,
      ...config,
    };
  }

  /**
   * 生成请求的唯一键
   */
  private getRequestKey(endpoint: string, options: RequestInit): string {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    const headers = this.getHeaderString(options.headers);

    return `${method}:${endpoint}:${headers}:${body}`;
  }

  /**
   * 获取请求头的字符串表示
   */
  private getHeaderString(headers?: HeadersInit): string {
    if (!headers) return '';

    if (headers instanceof Headers) {
      const headerObj: Record<string, string> = {};
      headers.forEach((value, key) => {
        // 只包含影响缓存的headers
        if (['authorization', 'accept', 'content-type'].includes(key.toLowerCase())) {
          headerObj[key] = value;
        }
      });
      return JSON.stringify(headerObj);
    }

    if (Array.isArray(headers)) {
      const relevantHeaders = headers.filter(([key]) =>
        ['authorization', 'accept', 'content-type'].includes(key.toLowerCase())
      );
      return JSON.stringify(relevantHeaders);
    }

    // Headers as object
    const headerObj: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers as Record<string, string>)) {
      if (['authorization', 'accept', 'content-type'].includes(key.toLowerCase())) {
        headerObj[key] = value;
      }
    }
    return JSON.stringify(headerObj);
  }

  /**
   * 添加请求到批处理队列
   */
  async addRequest<T>(
    endpoint: string,
    options: RequestInit,
    executeRequest: (endpoint: string, options: RequestInit) => Promise<T>
  ): Promise<T> {
    if (!this.config.enabled) {
      return executeRequest(endpoint, options);
    }

    this.metrics.totalRequests++;
    const requestKey = this.getRequestKey(endpoint, options);

    return new Promise<T>((resolve, reject) => {
      const pendingRequest: PendingRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        endpoint,
        options,
        resolve: resolve as any,
        reject,
        timestamp: Date.now(),
      };

      // 添加到待处理队列
      if (!this.pendingRequests.has(requestKey)) {
        this.pendingRequests.set(requestKey, []);
      }

      const queue = this.pendingRequests.get(requestKey)!;
      queue.push(pendingRequest);

      // 检查是否可以立即执行（已有相同请求在执行）
      if (queue.length === 1) {
        this.scheduleBatch(requestKey);
      } else {
        // 请求被合并
        this.metrics.mergedRequests++;
      }

      // 如果队列过长，立即执行
      if (queue.length >= this.config.maxBatchSize) {
        this.executeBatch(requestKey);
      }
    });
  }

  /**
   * 调度批处理执行
   */
  private scheduleBatch(requestKey: string): void {
    // 清除现有的定时器
    if (this.batchTimers.has(requestKey)) {
      clearTimeout(this.batchTimers.get(requestKey)!);
    }

    // 设置新的定时器
    const timer = setTimeout(() => {
      this.executeBatch(requestKey);
    }, this.config.windowMs);

    this.batchTimers.set(requestKey, timer);
  }

  /**
   * 执行批处理请求
   */
  private async executeBatch(requestKey: string): Promise<void> {
    const queue = this.pendingRequests.get(requestKey);
    if (!queue || queue.length === 0) return;

    // 清理定时器
    const timer = this.batchTimers.get(requestKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(requestKey);
    }

    // 移除队列
    this.pendingRequests.delete(requestKey);

    if (queue.length === 1) {
      // 单个请求直接执行
      const request = queue[0];
      try {
        this.executeSingleRequest(request);
      } catch (error) {
        request.reject(error as Error);
      }
      return;
    }

    // 批处理请求
    this.metrics.batchedRequests += queue.length - 1;
    console.log(`[RequestBatcher] 批处理 ${queue.length} 个相同请求: ${requestKey}`);

    // 执行第一个请求，其他请求共享结果
    const firstRequest = queue[0];
    const otherRequests = queue.slice(1);

    try {
      const response = await this.executeSingleRequest(firstRequest);

      // 所有请求都得到相同的响应
      otherRequests.forEach(request => {
        request.resolve(response.clone());
      });
    } catch (error) {
      // 所有请求都失败
      otherRequests.forEach(request => {
        request.reject(error as Error);
      });
    }
  }

  /**
   * 执行单个请求
   */
  private async executeSingleRequest(request: PendingRequest): Promise<Response> {
    const { endpoint, options } = request;

    // 这里需要使用实际的fetch函数
    // 为了保持解耦，我们通过注入的方式获取fetch函数
    const fetchFunction = (globalThis as any).__apiFetch || fetch;

    return fetchFunction(endpoint, options);
  }

  /**
   * 获取批处理指标
   */
  getMetrics() {
    return {
      ...this.metrics,
      mergeRate: this.metrics.totalRequests > 0
        ? (this.metrics.mergedRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      batchRate: this.metrics.totalRequests > 0
        ? (this.metrics.batchedRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  /**
   * 清理待处理的请求
   */
  clear(): void {
    // 清理所有定时器
    this.batchTimers.forEach(timer => clearTimeout(timer));
    this.batchTimers.clear();

    // 拒绝所有待处理的请求
    this.pendingRequests.forEach(queue => {
      queue.forEach(request => {
        request.reject(new Error('Request cancelled due to batcher cleanup'));
      });
    });
    this.pendingRequests.clear();
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 启用/禁用批处理
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }
}

// 全局批处理器实例
export const globalRequestBatcher = new RequestBatcher();

/**
 * 创建带批处理的fetch包装器
 */
export function createBatchedFetch(
  batcher: RequestBatcher = globalRequestBatcher
) {
  return async function batchedFetch(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    return batcher.addRequest(endpoint, options, async (ep, opts) => {
      const fetchFunction = (globalThis as any).__apiFetch || fetch;
      return fetchFunction(ep, opts);
    });
  };
}

/**
 * 批处理装饰器
 */
export function withBatching<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  batcher: RequestBatcher = globalRequestBatcher
): T {
  return (async (...args: Parameters<T>) => {
    // 如果第一个参数是endpoint，第二个是options，则使用批处理
    if (typeof args[0] === 'string' && typeof args[1] === 'object') {
      const [endpoint, options] = args;
      return batcher.addRequest(endpoint, options, (ep, opts) => fn(ep, opts));
    }

    // 否则直接执行原函数
    return fn(...args);
  }) as T;
}

/**
 * SWR批处理fetcher
 */
export function createBatchedSWRFetcher(
  batcher: RequestBatcher = globalRequestBatcher
) {
  return async function batchedSWRFetcher(endpoint: string, options?: { signal?: AbortSignal }) {
    const fetchOptions: RequestInit = {
      method: 'GET',
      signal: options?.signal,
    };

    const response = await batcher.addRequest(endpoint, fetchOptions, async (ep, opts) => {
      const fetchFunction = (globalThis as any).__apiFetch || fetch;
      return fetchFunction(ep, opts);
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  };
}

// 导出默认的批处理fetcher
export const batchedFetch = createBatchedFetch();
export const batchedSWRFetcher = createBatchedSWRFetcher();