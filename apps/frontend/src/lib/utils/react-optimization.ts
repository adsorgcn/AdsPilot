/**
 * React 组件优化工具
 * 提供常用的性能优化 hooks 和工具函数
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 使用防抖值
 * 用于输入框等需要延迟处理的场景
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 使用节流值
 * 用于滚动、resize 等高频事件
 */
export function useThrottledValue<T>(value: T, limit: number = 100): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef<number>(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

/**
 * 使用前一个值
 * 用于比较值的变化
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * 使用挂载状态
 * 避免在组件卸载后更新状态
 */
export function useIsMounted(): () => boolean {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current, []);
}

/**
 * 使用安全的异步状态更新
 * 只在组件挂载时更新状态
 */
export function useSafeState<T>(
  initialState: T | (() => T)
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState(initialState);
  const isMounted = useIsMounted();

  const setSafeState = useCallback(
    (value: T | ((prev: T) => T)) => {
      if (isMounted()) {
        setState(value);
      }
    },
    [isMounted]
  );

  return [state, setSafeState];
}

/**
 * 使用本地存储
 * 自动同步到 localStorage
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // 获取初始值
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error loading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // 更新值
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

/**
 * 使用媒体查询
 * 响应式设计辅助
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia(query);
    
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    media.addEventListener('change', listener);

    return () => {
      media.removeEventListener('change', listener);
    };
  }, [matches, query]);

  return matches;
}

/**
 * 使用窗口大小
 * 获取当前窗口尺寸
 */
export function useWindowSize(): { width: number; height: number } {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return windowSize;
}

/**
 * 使用交叉观察器
 * 用于懒加载和无限滚动
 */
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options?: IntersectionObserverInit
): IntersectionObserverEntry | null {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setEntry(entry);
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [elementRef, options]);

  return entry;
}

/**
 * 使用点击外部
 * 用于关闭下拉菜单等
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  callback: () => void
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClick);

    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [callback]);

  return ref;
}

/**
 * 使用间隔
 * 定时执行函数
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) {
      return;
    }

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => {
      clearInterval(id);
    };
  }, [delay]);
}

/**
 * 使用超时
 * 延迟执行函数
 */
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) {
      return;
    }

    const id = setTimeout(() => {
      savedCallback.current();
    }, delay);

    return () => {
      clearTimeout(id);
    };
  }, [delay]);
}

/**
 * 使用切换
 * 布尔值切换
 */
export function useToggle(
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue((v) => !v);
  }, []);

  return [value, toggle, setValue];
}

/**
 * 使用数组
 * 数组操作辅助
 */
export function useArray<T>(
  initialValue: T[] = []
): {
  value: T[];
  push: (item: T) => void;
  remove: (index: number) => void;
  clear: () => void;
  set: (value: T[]) => void;
} {
  const [value, setValue] = useState(initialValue);

  const push = useCallback((item: T) => {
    setValue((v) => [...v, item]);
  }, []);

  const remove = useCallback((index: number) => {
    setValue((v) => v.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => {
    setValue([]);
  }, []);

  return {
    value,
    push,
    remove,
    clear,
    set: setValue,
  };
}

/**
 * 使用异步函数
 * 处理异步操作的加载和错误状态
 */
export function useAsync<T, E = Error>(
  asyncFunction: () => Promise<T>,
  immediate: boolean = true
): {
  execute: () => Promise<void>;
  data: T | null;
  loading: boolean;
  error: E | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<E | null>(null);
  const isMounted = useIsMounted();

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await asyncFunction();
      if (isMounted()) {
        setData(result);
      }
    } catch (err) {
      if (isMounted()) {
        setError(err as E);
      }
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, [asyncFunction, isMounted]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, data, loading, error };
}

/**
 * 使用复制到剪贴板
 */
export function useCopyToClipboard(): {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
} {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error);
      setCopied(false);
      return false;
    }
  }, []);

  return { copy, copied };
}