/**
 * 性能优化工具函数
 */

// 图片优化配置
export const IMAGE_CONFIG = {
  quality: 90,
  placeholder: 'blur' as const,
  formats: ['image/webp', 'image/avif'] as const,
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
};

// 响应式图片尺寸
export const RESPONSIVE_SIZES = {
  hero: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw',
  card: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  thumbnail: '(max-width: 640px) 100vw, 200px',
  full: '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px',
};

// 生成blur placeholder的简化函数
export function generateBlurDataURL(width = 10, height = 10): string {
  // 生成一个简单的SVG blur placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#e5e7eb"/>
    </svg>
  `;

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// 预加载关键资源
export function preloadResource(href: string, as: string) {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    document.head.appendChild(link);
  }
}

// 预连接到关键域名
export function preconnectToDomain(domain: string) {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    document.head.appendChild(link);
  }
}

// 延迟加载非关键CSS
export function loadCSSDeferred(href: string) {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = 'print';
    link.onload = () => {
      link.media = 'all';
    };
    document.head.appendChild(link);
  }
}

// 检测网络速度并调整策略
export function getNetworkSpeed(): 'slow' | 'fast' {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return 'fast';
  }

  const connection = (navigator as any).connection;
  if (!connection) return 'fast';

  const effectiveType = connection.effectiveType;
  return effectiveType === 'slow-2g' || effectiveType === '2g' ? 'slow' : 'fast';
}

// 根据网络速度调整图片质量
export function getOptimizedQuality(baseQuality: number = 90): number {
  const networkSpeed = getNetworkSpeed();
  return networkSpeed === 'slow' ? Math.max(baseQuality - 20, 60) : baseQuality;
}

// 优化Web Vitals的工具函数
export function reportWebVitals(metric: any) {
  // 这里可以发送到分析服务
  if (process.env.NODE_ENV === 'production') {
    // 发送到分析平台
    console.log('Web Vital:', metric);
  }
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}