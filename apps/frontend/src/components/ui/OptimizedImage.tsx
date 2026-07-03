'use client';

import Image from 'next/image';
import { useState } from 'react';
import { generateBlurDataURL, getOptimizedQuality, RESPONSIVE_SIZES } from '~/lib/performance';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  fill?: boolean;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  sizes,
  quality,
  placeholder = 'blur',
  fill = false,
  style,
  loading,
  onLoad,
  onError,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // 自动选择合适的尺寸配置
  const imageSizes = sizes || (fill ? RESPONSIVE_SIZES.full : RESPONSIVE_SIZES.card);

  // 根据网络状况优化质量
  const optimizedQuality = quality || getOptimizedQuality();

  // 生成blur占位符
  const blurDataURL = generateBlurDataURL();

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
  };

  // 错误状态显示
  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/20 rounded-lg ${className}`}
        style={style}
      >
        <span className="text-muted-foreground text-sm">Failed to load image</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={style}>
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        quality={optimizedQuality}
        placeholder={placeholder}
        blurDataURL={placeholder === 'blur' ? blurDataURL : undefined}
        sizes={imageSizes}
        loading={loading || (priority ? 'eager' : 'lazy')}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          objectFit: 'cover',
          objectPosition: 'center',
        }}
        {...props}
      />

      {/* 加载状态指示器 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/10 rounded-lg">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}

// 预设的图片变体
export const ImageVariants = {
  // Hero区域大图
  Hero: ({ src, alt, className, ...props }: Omit<OptimizedImageProps, 'priority' | 'sizes'>) => (
    <OptimizedImage
      src={src}
      alt={alt}
      priority={true}
      sizes={RESPONSIVE_SIZES.hero}
      quality={90}
      className={className}
      {...props}
    />
  ),

  // 卡片图片
  Card: ({ src, alt, className, ...props }: Omit<OptimizedImageProps, 'sizes'>) => (
    <OptimizedImage
      src={src}
      alt={alt}
      sizes={RESPONSIVE_SIZES.card}
      quality={85}
      className={className}
      {...props}
    />
  ),

  // 头像/缩略图
  Avatar: ({ src, alt, className, ...props }: Omit<OptimizedImageProps, 'sizes'>) => (
    <OptimizedImage
      src={src}
      alt={alt}
      sizes="48px"
      quality={80}
      className={className}
      {...props}
    />
  ),

  // 缩略图
  Thumbnail: ({ src, alt, className, ...props }: Omit<OptimizedImageProps, 'sizes'>) => (
    <OptimizedImage
      src={src}
      alt={alt}
      sizes={RESPONSIVE_SIZES.thumbnail}
      quality={75}
      className={className}
      {...props}
    />
  ),
} as const;