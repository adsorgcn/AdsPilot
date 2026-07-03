'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePerformanceMetrics } from '~/core/state/GlobalStateProvider';

// 图片格式类型
export type ImageFormat = 'webp' | 'avif' | 'jpg' | 'png' | 'gif' | 'svg';

// 图片优化配置
interface ImageOptimizationConfig {
  // 格式支持检测
  enableWebP: boolean;
  enableAVIF: boolean;

  // 加载策略
  loadingStrategy: 'eager' | 'lazy' | 'preload';

  // 响应式配置
  sizes: {
    mobile: number;    // 移动端最大宽度
    tablet: number;    // 平板最大宽度
    desktop: number;   // 桌面最大宽度
  };

  // 质量设置
  quality: {
    webp: number;
    jpg: number;
    png: number;
  };

  // 压缩设置
  compression: 'low' | 'medium' | 'high';

  // 缓存配置
  cacheStrategy: 'memory' | 'service-worker' | 'both';

  // 性能监控
  enablePerformanceTracking: boolean;
}

// 默认配置
const DEFAULT_CONFIG: ImageOptimizationConfig = {
  enableWebP: true,
  enableAVIF: true,
  loadingStrategy: 'lazy',
  sizes: {
    mobile: 768,
    tablet: 1024,
    desktop: 1920,
  },
  quality: {
    webp: 80,
    jpg: 85,
    png: 90,
  },
  compression: 'medium',
  cacheStrategy: 'both',
  enablePerformanceTracking: true,
};

// 图片优化Hook
export function useImageOptimizer(customConfig: Partial<ImageOptimizationConfig> = {}) {
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...customConfig }), [customConfig]);
  const { recordInteraction, recordApiResponse } = usePerformanceMetrics();

  // 格式支持检测缓存
  const [formatSupport, setFormatSupport] = useState({
    webp: false,
    avif: false,
  });

  // 图片缓存
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // 加载队列
  const loadingQueue = useRef<Map<string, Promise<HTMLImageElement>>>(new Map());

  // 性能统计
  const [stats, setStats] = useState({
    totalLoaded: 0,
    totalSize: 0,
    averageLoadTime: 0,
    cacheHits: 0,
    formatUsage: {
      webp: 0,
      avif: 0,
      jpg: 0,
      png: 0,
      gif: 0,
      svg: 0,
    },
  });

  // 检测格式支持
  useEffect(() => {
    const checkFormatSupport = async () => {
      // 检测WebP支持
      const webpSupport = await checkWebPSupport();

      // 检测AVIF支持
      const avifSupport = await checkAVIFSupport();

      setFormatSupport({
        webp: webpSupport && config.enableWebP,
        avif: avifSupport && config.enableAVIF,
      });
    };

    checkFormatSupport();
  }, [config.enableWebP, config.enableAVIF]);

  // 检测WebP支持
  const checkWebPSupport = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const webP = new Image();
      webP.onload = webP.onerror = () => {
        resolve(webP.height === 2);
      };
      webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    });
  };

  // 检测AVIF支持
  const checkAVIFSupport = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const avif = new Image();
      avif.onload = avif.onerror = () => {
        resolve(avif.height === 2);
      };
      avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAzMAAABvY2xyYQAAAAARAcAADZwAASAAAAE3cGluAAAAAAAAwAAAAAAAAAAAAAAAQABAwADAAAAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEA';
    });
  };

  // 获取最佳格式
  const getOptimalFormat = (originalFormat: ImageFormat): ImageFormat => {
    if (formatSupport.avif && canConvertToAVIF(originalFormat)) {
      return 'avif';
    }
    if (formatSupport.webp && canConvertToWebP(originalFormat)) {
      return 'webp';
    }
    return originalFormat;
  };

  // 检查是否可以转换为AVIF
  const canConvertToAVIF = (format: ImageFormat): boolean => {
    return ['jpg', 'png', 'gif'].includes(format);
  };

  // 检查是否可以转换为WebP
  const canConvertToWebP = (format: ImageFormat): boolean => {
    return ['jpg', 'png', 'gif'].includes(format);
  };

  // 生成优化后的图片URL
  const generateOptimizedUrl = useCallback((
    originalUrl: string,
    width?: number,
    height?: number,
    quality?: number,
    format?: ImageFormat
  ): string => {
    const url = new URL(originalUrl, window.location.origin);

    // 添加优化参数
    const params = new URLSearchParams(url.search);

    if (width) {
      params.set('w', width.toString());
    }

    if (height) {
      params.set('h', height.toString());
    }

    // 质量设置
    const finalQuality = quality || config.quality[format || 'jpg'];
    params.set('q', finalQuality.toString());

    // 格式设置
    const originalFormat = detectImageFormat(originalUrl);
    const optimalFormat = format || getOptimalFormat(originalFormat);
    if (optimalFormat !== originalFormat) {
      params.set('f', optimalFormat);
    }

    // 压缩设置
    params.set('c', config.compression);

    // 版本控制（缓存破坏）
    params.set('v', '1');

    url.search = params.toString();
    return url.toString();
  }, [config.compression, config.quality, formatSupport, getOptimalFormat]);

  // 检测图片格式
  const detectImageFormat = (url: string): ImageFormat => {
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'webp': return 'webp';
      case 'avif': return 'avif';
      case 'jpg':
      case 'jpeg': return 'jpg';
      case 'png': return 'png';
      case 'gif': return 'gif';
      case 'svg': return 'svg';
      default: return 'jpg';
    }
  };

  // 预加载图片
  const preloadImage = useCallback(async (url: string): Promise<HTMLImageElement> => {
    // 检查缓存
    if (imageCache.current.has(url)) {
      const cachedImage = imageCache.current.get(url)!;
      setStats(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
      return cachedImage;
    }

    // 检查是否正在加载
    if (loadingQueue.current.has(url)) {
      return loadingQueue.current.get(url)!;
    }

    const startTime = performance.now();

    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const loadTime = performance.now() - startTime;

        // 缓存图片
        if (imageCache.current.size < 50) { // 限制缓存大小
          imageCache.current.set(url, img);
        }

        // 更新统计
        setStats(prev => {
          const newTotalLoaded = prev.totalLoaded + 1;
          const newAverageLoadTime = (prev.averageLoadTime * prev.totalLoaded + loadTime) / newTotalLoaded;

          const format = detectImageFormat(url);
          const newFormatUsage = { ...prev.formatUsage };
          newFormatUsage[format] = (newFormatUsage[format] || 0) + 1;

          return {
            ...prev,
            totalLoaded: newTotalLoaded,
            averageLoadTime: newAverageLoadTime,
            formatUsage: newFormatUsage,
          };
        });

        // 记录性能指标
        if (config.enablePerformanceTracking) {
          recordInteraction('image_load', loadTime);
          recordApiResponse('image_load', loadTime);
        }

        resolve(img);
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${url}`));
      };

      // 设置优化后的URL
      const optimizedUrl = generateOptimizedUrl(url);
      img.src = optimizedUrl;
    });

    loadingQueue.current.set(url, loadPromise);

    try {
      const result = await loadPromise;
      loadingQueue.current.delete(url);
      return result;
    } catch (error) {
      loadingQueue.current.delete(url);
      throw error;
    }
  }, [generateOptimizedUrl, config.enablePerformanceTracking, recordInteraction, recordApiResponse]);

  // 生成响应式图片源
  const generateResponsiveSources = useCallback((
    originalUrl: string,
    alt?: string,
    className?: string
  ): Array<{
    srcSet: string;
    media?: string;
    type?: string;
  }> => {
    const sources: Array<{
      srcSet: string;
      media?: string;
      type?: string;
    }> = [];

    const originalFormat = detectImageFormat(originalUrl);
    const optimalFormat = getOptimalFormat(originalFormat);

    // 生成不同尺寸的srcSet
    const sizes = [
      { width: config.sizes.mobile, media: '(max-width: 768px)' },
      { width: config.sizes.tablet, media: '(max-width: 1024px)' },
      { width: config.sizes.desktop },
    ];

    // 为每个尺寸生成srcSet
    sizes.forEach(({ width, media }) => {
      const srcSet = [
        generateOptimizedUrl(originalUrl, Math.round(width * 0.5)),  // 0.5x
        generateOptimizedUrl(originalUrl, Math.round(width * 0.75)), // 0.75x
        generateOptimizedUrl(originalUrl, Math.round(width)),         // 1x
        generateOptimizedUrl(originalUrl, Math.round(width * 1.5)),   // 1.5x
        generateOptimizedUrl(originalUrl, Math.round(width * 2)),     // 2x
      ].map((url, index) => `${url} ${[0.5, 0.75, 1, 1.5, 2][index]}x`).join(', ');

      sources.push({
        srcSet,
        media,
      });
    });

    // 添加格式支持
    if (optimalFormat !== originalFormat) {
      const typeMap: Record<ImageFormat, string> = {
        webp: 'image/webp',
        avif: 'image/avif',
        jpg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        svg: 'image/svg+xml',
      };

      sources.unshift({
        srcSet: generateOptimizedUrl(originalUrl, undefined, undefined, undefined, optimalFormat),
        type: typeMap[optimalFormat],
      });
    }

    return sources;
  }, [config.sizes, generateOptimizedUrl, formatSupport, getOptimalFormat]);

  // 懒加载观察器
  const createLazyObserver = useCallback((callback: (entries: IntersectionObserverEntry[]) => void) => {
    if (typeof IntersectionObserver === 'undefined') {
      return null;
    }

    return new IntersectionObserver(callback, {
      rootMargin: '50px 0px', // 提前50px开始加载
      threshold: 0.01,
    });
  }, []);

  // 清理缓存
  const clearCache = useCallback(() => {
    imageCache.current.clear();
    loadingQueue.current.clear();
    setStats({
      totalLoaded: 0,
      totalSize: 0,
      averageLoadTime: 0,
      cacheHits: 0,
      formatUsage: {
        webp: 0,
        avif: 0,
        jpg: 0,
        png: 0,
        gif: 0,
        svg: 0,
      },
    });
  }, []);

  // 获取缓存统计
  const getCacheStats = useCallback(() => {
    return {
      cacheSize: imageCache.current.size,
      loadingQueueSize: loadingQueue.current.size,
      stats,
      formatSupport,
    };
  }, [stats, formatSupport]);

  return {
    // 核心功能
    preloadImage,
    generateOptimizedUrl,
    generateResponsiveSources,
    createLazyObserver,

    // 配置和状态
    config,
    formatSupport,
    stats,

    // 工具方法
    detectImageFormat,
    getOptimalFormat,
    clearCache,
    getCacheStats,
  };
}

// 优化图片组件
interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: 'eager' | 'lazy';
  sizes?: string;
  quality?: number;
  format?: ImageFormat;
  placeholder?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  loading = 'lazy',
  sizes = '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw',
  quality,
  format,
  placeholder = 'data:image/svg+xml,%3Csvg width="1" height="1" xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E',
  onLoad,
  onError,
}: OptimizedImageProps) {
  const {
    preloadImage,
    generateResponsiveSources,
    createLazyObserver,
    config,
  } = useImageOptimizer();

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 懒加载逻辑
  useEffect(() => {
    if (loading === 'eager') {
      loadImage();
      return;
    }

    const observer = createLazyObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadImage();
          observerRef.current?.unobserve(entry.target);
        }
      });
    });

    if (observer && imgRef.current) {
      observerRef.current = observer;
      observer.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [loading, createLazyObserver, loadImage]);

  // 加载图片
  const loadImage = async () => {
    try {
      const img = await preloadImage(src);

      if (imgRef.current) {
        imgRef.current.src = img.src;
        setImageLoaded(true);
        setImageError(null);
        onLoad?.();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setImageError(errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  };

  // 生成响应式源
  const sources = generateResponsiveSources(src, alt, className);

  return (
    <div className={`relative ${className}`}>
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
      )}

      {imageError ? (
        <div className="flex items-center justify-center h-full bg-gray-100 rounded border-2 border-dashed border-gray-300">
          <div className="text-center p-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-600">图片加载失败</p>
          </div>
        </div>
      ) : (
        <picture>
          {sources.map((source, index) => (
            <source
              key={index}
              srcSet={source.srcSet}
              media={source.media}
              type={source.type}
            />
          ))}
          <img
            ref={imgRef}
            src={placeholder}
            alt={alt}
            width={width}
            height={height}
            sizes={sizes}
            className={`transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading={loading}
          />
        </picture>
      )}
    </div>
  );
}

// 图片占位符组件
interface ImagePlaceholderProps {
  width?: number;
  height?: number;
  className?: string;
  children?: React.ReactNode;
}

export function ImagePlaceholder({ width, height, className = '', children }: ImagePlaceholderProps) {
  return (
    <div
      className={`flex items-center justify-center bg-gray-200 rounded ${className}`}
      style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : 'auto' }}
    >
      {children || (
        <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )}
    </div>
  );
}