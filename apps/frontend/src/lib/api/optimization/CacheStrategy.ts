/**
 * 智能缓存策略和轮询优化
 *
 * 提供基于数据类型和使用场景的智能缓存策略
 */

export interface CacheConfig {
  /** 缓存时间（毫秒） */
  ttl: number;
  /** 是否在焦点时重新验证 */
  revalidateOnFocus: boolean;
  /** 是否在重新连接时重新验证 */
  revalidateOnReconnect: boolean;
  /** 是否在挂载时重新验证 */
  revalidateOnMount: boolean;
  /** 去重间隔（毫秒） */
  dedupingInterval: number;
  /** 错误重试次数 */
  errorRetryCount: number;
  /** 错误重试间隔（毫秒） */
  errorRetryInterval: number;
  /** 是否保持先前数据 */
  keepPreviousData: boolean;
}

export interface CacheStrategy {
  /** 缓存类型 */
  type: 'static' | 'dynamic' | 'realtime' | 'polling';
  /** 缓存配置 */
  config: CacheConfig;
  /** 描述 */
  description: string;
}

/**
 * 缓存策略定义
 */
export const CACHE_STRATEGIES: Record<string, CacheStrategy> = {
  // 静态数据 - 很少变化
  static: {
    type: 'static',
    config: {
      ttl: 10 * 60 * 1000, // 10分钟
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateOnMount: false,
      dedupingInterval: 5 * 60 * 1000, // 5分钟
      errorRetryCount: 2,
      errorRetryInterval: 5000,
      keepPreviousData: true
    },
    description: '静态数据，如配置信息、价格表等'
  },

  // 动态数据 - 需要保持相对新鲜
  dynamic: {
    type: 'dynamic',
    config: {
      ttl: 2 * 60 * 1000, // 2分钟
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateOnMount: true,
      dedupingInterval: 30 * 1000, // 30秒
      errorRetryCount: 3,
      errorRetryInterval: 3000,
      keepPreviousData: true
    },
    description: '动态数据，如用户信息、订阅状态等'
  },

  // 实时数据 - 需要保持最新状态
  realtime: {
    type: 'realtime',
    config: {
      ttl: 30 * 1000, // 30秒
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateOnMount: true,
      dedupingInterval: 10 * 1000, // 10秒
      errorRetryCount: 3,
      errorRetryInterval: 2000,
      keepPreviousData: true
    },
    description: '实时数据，如Token余额、任务状态等'
  },

  // 轮询数据 - 定期更新
  polling: {
    type: 'polling',
    config: {
      ttl: 15 * 1000, // 15秒（轮询间隔）
      revalidateOnFocus: false, // 轮询时不需要焦点重新验证
      revalidateOnReconnect: true,
      revalidateOnMount: true,
      dedupingInterval: 20 * 1000, // 20秒
      errorRetryCount: 2,
      errorRetryInterval: 5000,
      keepPreviousData: true
    },
    description: '轮询数据，如任务执行状态、系统监控等'
  }
};

/**
 * 数据类型到缓存策略的映射
 */
export const ENDPOINT_CACHE_STRATEGY: Record<string, keyof typeof CACHE_STRATEGIES> = {
  // Billing相关
  '/api/v1/billing/config/pricing': 'static',
  '/api/v1/billing/config/all': 'static',
  '/api/v1/billing/subscription': 'dynamic',
  '/api/v1/billing/subscriptions/me': 'dynamic',
  '/api/v1/billing/tokens/balance': 'realtime',
  '/api/v1/billing/tokens/transactions': 'dynamic',
  '/api/v1/billing/tokens/usage': 'dynamic',

  // Offers相关
  '/api/v1/offers': 'dynamic',
  '/api/v1/offers/*/status': 'realtime',
  '/api/v1/offers/*/kpi': 'dynamic',
  '/api/v1/offers/*/evaluate': 'realtime',
  '/api/v1/offers/*/evaluation': 'realtime',

  // Console相关
  '/api/v1/console/stats': 'dynamic',
  '/api/v1/console/dashboard/stats': 'dynamic',
  '/api/v1/console/tasks': 'polling',
  '/api/v1/console/tasks/stream': 'realtime',
  '/api/v1/console/users': 'dynamic',

  // User Activity相关
  '/api/v1/check-in/status': 'realtime',
  '/api/v1/referral': 'dynamic',
  '/api/v1/check-in/history': 'dynamic',

  // AdsCenter相关
  '/api/v1/adscenter/accounts': 'dynamic',
  '/api/v1/adscenter/accounts/stream': 'realtime',
  '/api/v1/adscenter/limits/me': 'dynamic',
  '/api/v1/adscenter/executions': 'polling'
};

/**
 * 获取端点的缓存策略
 */
export function getCacheStrategy(endpoint: string): CacheStrategy {
  // 精确匹配
  if (ENDPOINT_CACHE_STRATEGY[endpoint]) {
    return CACHE_STRATEGIES[ENDPOINT_CACHE_STRATEGY[endpoint]];
  }

  // 模式匹配
  for (const [pattern, strategy] of Object.entries(ENDPOINT_CACHE_STRATEGY)) {
    if (endpoint.includes(pattern.replace(/\*/g, ''))) {
      return CACHE_STRATEGIES[strategy];
    }
  }

  // 默认策略：动态数据
  return CACHE_STRATEGIES.dynamic;
}

/**
 * 智能缓存配置生成器
 */
export class SmartCacheConfig {
  private customStrategies: Map<string, CacheStrategy> = new Map();

  /**
   * 注册自定义缓存策略
   */
  registerStrategy(endpoint: string, strategy: CacheStrategy): void {
    this.customStrategies.set(endpoint, strategy);
  }

  /**
   * 获取缓存配置
   */
  getConfig(endpoint: string, customConfig?: Partial<CacheConfig>): CacheConfig {
    // 优���使用自定义策略
    if (this.customStrategies.has(endpoint)) {
      const strategy = this.customStrategies.get(endpoint)!;
      return { ...strategy.config, ...customConfig };
    }

    // 使用预定义策略
    const strategy = getCacheStrategy(endpoint);
    return { ...strategy.config, ...customConfig };
  }

  /**
   * 获取轮询配置
   */
  getPollingConfig(endpoint: string, interval?: number): CacheConfig {
    const baseConfig = this.getConfig(endpoint);

    return {
      ...baseConfig,
      ttl: interval || baseConfig.ttl,
      revalidateOnFocus: false // 轮询时禁用焦点重新验证
    };
  }

  /**
   * 获取实时配置
   */
  getRealtimeConfig(endpoint: string): CacheConfig {
    return this.getConfig(endpoint, {
      ttl: 10 * 1000, // 10秒
      dedupingInterval: 5 * 1000, // 5秒
      errorRetryInterval: 1000 // 快速重试
    });
  }

  /**
   * 获取静态配置
   */
  getStaticConfig(endpoint: string): CacheConfig {
    return this.getConfig(endpoint, {
      ttl: 30 * 60 * 1000, // 30分钟
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 15 * 60 * 1000 // 15分钟
    });
  }
}

// 全局缓存配置实例
export const smartCacheConfig = new SmartCacheConfig();

/**
 * 缓存策略装饰器
 */
export function withCacheStrategy<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  strategy: CacheStrategy | keyof typeof CACHE_STRATEGIES
): T {
  return (async (...args: Parameters<T>) => {
    const cacheStrategy = typeof strategy === 'string'
      ? CACHE_STRATEGIES[strategy]
      : strategy;

    // 这里可以添加实际的缓存逻辑
    // 比如基于Redis、Memory Storage等
    return fn(...args);
  }) as T;
}

/**
 * 基于使用频率的自适应缓存策略
 */
export class AdaptiveCacheStrategy {
  private usageStats = new Map<string, { count: number; lastAccess: number }>();

  /**
   * 记录端点使用
   */
  recordUsage(endpoint: string): void {
    const now = Date.now();
    const current = this.usageStats.get(endpoint) || { count: 0, lastAccess: now };

    this.usageStats.set(endpoint, {
      count: current.count + 1,
      lastAccess: now
    });

    // 清理过期记录
    this.cleanup();
  }

  /**
   * 获取自适应缓存配置
   */
  getAdaptiveConfig(endpoint: string): CacheConfig {
    const usage = this.usageStats.get(endpoint);
    const baseStrategy = getCacheStrategy(endpoint);

    // 高频使用的数据使用更长的缓存
    if (usage && usage.count > 10) {
      return {
        ...baseStrategy.config,
        ttl: baseStrategy.config.ttl * 2, // 双倍缓存时间
        dedupingInterval: baseStrategy.config.dedupingInterval * 2
      };
    }

    return baseStrategy.config;
  }

  private cleanup(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const [endpoint, stats] of this.usageStats.entries()) {
      if (stats.lastAccess < oneHourAgo) {
        this.usageStats.delete(endpoint);
      }
    }
  }
}

export const adaptiveCacheStrategy = new AdaptiveCacheStrategy();