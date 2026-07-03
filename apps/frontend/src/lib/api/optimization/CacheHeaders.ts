/**
 * HTTP缓存头优化
 *
 * 提供智能的HTTP缓存头设置，提升API响应性能
 */

export interface CacheHeaderConfig {
  /** Cache-Control指令 */
  cacheControl: string;
  /** ETag值 */
  etag?: string;
  /** Last-Modified时间 */
  lastModified?: string;
  /** Vary指令 */
  vary?: string[];
  /** 自定义头 */
  customHeaders?: Record<string, string>;
}

export type CacheType =
  | 'no-cache'      // 不缓存
  | 'short'         // 短缓存（5分钟）
  | 'medium'        // 中等缓存（30分钟）
  | 'long'          // 长期缓存（2小时）
  | 'immutable'     // 不可变（1天）
  | 'user-specific'; // 用户特定数据

/**
 * 缓存类型配置
 */
export const CACHE_HEADERS: Record<CacheType, CacheHeaderConfig> = {
  'no-cache': {
    cacheControl: 'no-store, no-cache, must-revalidate, max-age=0',
    vary: ['Authorization']
  },

  'short': {
    cacheControl: 'public, max-age=300', // 5分钟
    vary: ['Authorization']
  },

  'medium': {
    cacheControl: 'public, max-age=1800', // 30分钟
    vary: ['Authorization']
  },

  'long': {
    cacheControl: 'public, max-age=7200', // 2小时
    vary: ['Authorization']
  },

  'immutable': {
    cacheControl: 'public, max-age=86400, immutable', // 1天
    vary: ['Authorization']
  },

  'user-specific': {
    cacheControl: 'private, max-age=300', // 5分钟，私有缓存
    vary: ['Authorization', 'Accept-Language']
  }
};

/**
 * 缓存策略映射
 */
export const ENDPOINT_CACHE_TYPE: Record<string, CacheType> = {
  // 静态数据 - 长期缓存
  '/api/v1/billing/config/pricing': 'immutable',
  '/api/v1/billing/config/all': 'long',
  '/api/v1/billing/config/history': 'medium',

  // 用户数据 - 短期私有缓存
  '/api/v1/billing/subscription': 'short',
  '/api/v1/billing/subscriptions/me': 'short',
  '/api/v1/billing/tokens/transactions': 'medium',
  '/api/v1/billing/tokens/usage': 'medium',

  // 实时数据 - 不缓存
  '/api/v1/billing/tokens/balance': 'no-cache',
  '/api/v1/billing/tokens/reserve': 'no-cache',
  '/api/v1/billing/tokens/commit': 'no-cache',

  // Offers数据 - 混合策略
  '/api/v1/offers': 'short',
  '/api/v1/offers/*/kpi': 'medium',
  '/api/v1/offers/*/preferences': 'long',
  '/api/v1/offers/*/accounts': 'short',

  // 实时操作 - 不缓存
  '/api/v1/offers/*/evaluate': 'no-cache',
  '/api/v1/offers/*/status': 'no-cache',
  '/api/v1/offers/*/evaluation': 'no-cache',

  // Console数据 - 用户特定
  '/api/v1/console/stats': 'user-specific',
  '/api/v1/console/dashboard/stats': 'user-specific',
  '/api/v1/console/users': 'user-specific',
  '/api/v1/console/tasks': 'user-specific',

  // User Activity - 用户特定
  '/api/v1/check-in/status': 'no-cache',
  '/api/v1/referral': 'short',
  '/api/v1/check-in/history': 'medium',

  // AdsCenter数据 - 混合策略
  '/api/v1/adscenter/accounts': 'short',
  '/api/v1/adscenter/limits/me': 'short',
  '/api/v1/adscenter/configurations': 'medium',
  '/api/v1/adscenter/executions': 'short'
};

/**
 * 获取缓存头配置
 */
export function getCacheHeaders(endpoint: string, customType?: CacheType): CacheHeaderConfig {
  const cacheType = customType || ENDPOINT_CACHE_TYPE[endpoint] || 'short';

  const baseConfig = CACHE_HEADERS[cacheType];

  // 为动态数据添加ETag支持
  if (shouldUseETag(endpoint)) {
    return {
      ...baseConfig,
      customHeaders: {
        ...baseConfig.customHeaders,
        'X-Cache-Strategy': cacheType
      }
    };
  }

  return {
    ...baseConfig,
    customHeaders: {
      ...baseConfig.customHeaders,
      'X-Cache-Strategy': cacheType
    }
  };
}

/**
 * 判断是否应该使用ETag
 */
function shouldUseETag(endpoint: string): boolean {
  const etagEndpoints = [
    '/api/v1/offers/*/kpi',
    '/api/v1/offers/*/preferences',
    '/api/v1/adscenter/configurations',
    '/api/v1/billing/config/all'
  ];

  return etagEndpoints.some(pattern => endpoint.includes(pattern.replace('/*', '')));
}

/**
 * 生成ETag
 */
export function generateETag(data: any): string {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = btoa(dataString).replace(/[^a-zA-Z0-9]/g, '');
  return `W/"${hash.substring(0, 16)}"`;
}

/**
 * Next.js API路由缓存助手
 */
export function setCacheHeaders(
  response: Response,
  endpoint: string,
  data?: any,
  cacheType?: CacheType
): Response {
  const cacheConfig = getCacheHeaders(endpoint, cacheType);
  const headers = new Headers(response.headers);

  // 设置标准缓存头
  headers.set('Cache-Control', cacheConfig.cacheControl);

  // 设置Vary头
  if (cacheConfig.vary) {
    headers.set('Vary', cacheConfig.vary.join(', '));
  }

  // 设置ETag
  if (cacheConfig.etag || (data && shouldUseETag(endpoint))) {
    const etag = cacheConfig.etag || generateETag(data);
    headers.set('ETag', etag);
  }

  // 设置Last-Modified
  if (cacheConfig.lastModified) {
    headers.set('Last-Modified', cacheConfig.lastModified);
  } else if (data) {
    headers.set('Last-Modified', new Date().toUTCString());
  }

  // 设置自定义头
  if (cacheConfig.customHeaders) {
    for (const [key, value] of Object.entries(cacheConfig.customHeaders)) {
      headers.set(key, value);
    }
  }

  // 创建新的Response对象
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * 检查缓存是否新鲜
 */
export function isCacheFresh(response: Response): boolean {
  const cacheControl = response.headers.get('cache-control');
  if (!cacheControl) return false;

  // 检查max-age
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  if (maxAgeMatch) {
    const maxAge = parseInt(maxAgeMatch[1]);
    const dateHeader = response.headers.get('date');
    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime();
      const currentTime = Date.now();
      const age = (currentTime - serverTime) / 1000;
      return age < maxAge;
    }
  }

  // 检查no-cache指令
  if (cacheControl.includes('no-cache') || cacheControl.includes('no-store')) {
    return false;
  }

  return true;
}

/**
 * 条件请求处理器
 */
export function handleConditionalRequest(
  request: Request,
  response: Response
): Response | null {
  const ifNoneMatch = request.headers.get('if-none-match');
  const ifModifiedSince = request.headers.get('if-modified-since');
  const etag = response.headers.get('etag');
  const lastModified = response.headers.get('last-modified');

  // 处理ETag条件请求
  if (ifNoneMatch && etag && ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: response.headers });
  }

  // 处理Last-Modified条件请求
  if (ifModifiedSince && lastModified) {
    const requestTime = new Date(ifModifiedSince).getTime();
    const responseTime = new Date(lastModified).getTime();

    if (requestTime >= responseTime) {
      return new Response(null, { status: 304, headers: response.headers });
    }
  }

  return null;
}

/**
 * 缓存装饰器
 */
export function withCache<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  endpoint?: string,
  cacheType?: CacheType
): T {
  return (async (...args: Parameters<T>) => {
    const response = await handler(...args);

    const finalEndpoint = endpoint || (args[0] as string);

    return setCacheHeaders(response, finalEndpoint, undefined, cacheType);
  }) as T;
}

/**
 * 性能优化提示
 */
export const CACHE_OPTIMIZATION_TIPS = {
  // 高频访问的静态资源
  static: {
    ttl: '86400s (24 hours)',
    strategy: 'immutable',
    headers: 'Cache-Control: public, max-age=86400, immutable'
  },

  // 用户特定数据
  user: {
    ttl: '300s (5 minutes)',
    strategy: 'private',
    headers: 'Cache-Control: private, max-age=300'
  },

  // 动态内容
  dynamic: {
    ttl: '300s (5 minutes)',
    strategy: 'revalidate',
    headers: 'Cache-Control: public, max-age=300, must-revalidate'
  },

  // 实时数据
  realtime: {
    ttl: '0s (no-cache)',
    strategy: 'no-store',
    headers: 'Cache-Control: no-store, no-cache, must-revalidate'
  }
} as const;