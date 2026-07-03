/**
 * 性能监控和优化工具
 */

import { createLogger } from './logger';

const logger = createLogger('Performance');

/**
 * 性能标记类型
 */
type PerformanceMark = {
  name: string;
  startTime: number;
  duration?: number;
};

/**
 * 性能监控器
 */
class PerformanceMonitor {
  private marks: Map<string, PerformanceMark> = new Map();
  private enabled: boolean;

  constructor() {
    this.enabled = typeof window !== 'undefined' && 'performance' in window;
  }

  /**
   * 开始性能标记
   */
  start(name: string): void {
    if (!this.enabled) {
      return;
    }

    const startTime = performance.now();
    this.marks.set(name, { name, startTime });
    
    if (performance.mark) {
      performance.mark(`${name}-start`);
    }
  }

  /**
   * 结束性能标记并记录
   */
  end(name: string): number | null {
    if (!this.enabled) {
      return null;
    }

    const mark = this.marks.get(name);
    if (!mark) {
      logger.warn(`Performance mark "${name}" not found`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - mark.startTime;
    
    mark.duration = duration;
    
    if (performance.mark && performance.measure) {
      performance.mark(`${name}-end`);
      try {
        performance.measure(name, `${name}-start`, `${name}-end`);
      } catch (error) {
        // Ignore measurement errors
      }
    }

    logger.debug(`${name}: ${duration.toFixed(2)}ms`);
    
    return duration;
  }

  /**
   * 获取性能标记
   */
  getMark(name: string): PerformanceMark | undefined {
    return this.marks.get(name);
  }

  /**
   * 清除性能标记
   */
  clear(name?: string): void {
    if (name) {
      this.marks.delete(name);
      if (performance.clearMarks) {
        performance.clearMarks(`${name}-start`);
        performance.clearMarks(`${name}-end`);
      }
      if (performance.clearMeasures) {
        performance.clearMeasures(name);
      }
    } else {
      this.marks.clear();
      if (performance.clearMarks) {
        performance.clearMarks();
      }
      if (performance.clearMeasures) {
        performance.clearMeasures();
      }
    }
  }

  /**
   * 获取所有性能标记
   */
  getAllMarks(): PerformanceMark[] {
    return Array.from(this.marks.values());
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * 性能装饰器 - 用于测量函数执行时间
 */
export function measurePerformance(name?: string) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const measureName = name || `${String(propertyKey)}`;

    descriptor.value = async function (...args: unknown[]) {
      performanceMonitor.start(measureName);
      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } finally {
        performanceMonitor.end(measureName);
      }
    };

    return descriptor;
  };
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 批处理函数调用
 */
export function batchCalls<T>(
  func: (items: T[]) => void | Promise<void>,
  wait: number = 100
): (item: T) => void {
  let items: T[] = [];
  let timeout: NodeJS.Timeout | null = null;

  return function (item: T) {
    items.push(item);

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(async () => {
      const batch = [...items];
      items = [];
      await func(batch);
    }, wait);
  };
}

/**
 * 重试函数
 */
export async function retry<T>(
  func: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay: delayMs = 1000, backoff = true } = options;

  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await func();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxAttempts) {
        const waitTime = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
        logger.warn(`Attempt ${attempt} failed, retrying in ${waitTime}ms...`);
        await delay(waitTime);
      }
    }
  }

  throw lastError;
}

/**
 * 内存优化 - 清理大对象
 */
export function clearLargeObject<T extends Record<string, unknown>>(obj: T): void {
  Object.keys(obj).forEach((key) => {
    delete obj[key];
  });
}

/**
 * 检查是否为慢速网络
 */
export function isSlowNetwork(): boolean {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return false;
  }

  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  const effectiveType = connection?.effectiveType;

  return effectiveType === 'slow-2g' || effectiveType === '2g';
}

/**
 * 获取设备内存信息
 */
export function getDeviceMemory(): number | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  return (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
}

/**
 * 检查是否为低端设备
 */
export function isLowEndDevice(): boolean {
  const memory = getDeviceMemory();
  const cores = navigator.hardwareConcurrency || 1;

  // 内存小于 4GB 或 CPU 核心数小于 4 认为是低端设备
  return (memory !== undefined && memory < 4) || cores < 4;
}