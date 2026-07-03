'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowPathIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

// 加载状态类型
export type LoadingType = 'spinner' | 'dots' | 'pulse' | 'skeleton' | 'progress' | 'wave';

// 骨架屏组件
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
  animated?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  lines = 1,
  animated = true
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-none';
      case 'rounded':
        return 'rounded-lg';
      case 'text':
      default:
        return 'rounded';
    }
  };

  const baseClasses = cn(
    'bg-gray-200',
    getVariantStyles(),
    animated && 'animate-pulse',
    className
  );

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1rem' : undefined),
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              baseClasses,
              index === lines - 1 ? 'w-3/4' : 'w-full'
            )}
            style={{
              height: height || '1rem',
            }}
          />
        ))}
      </div>
    );
  }

  return <div className={baseClasses} style={style} />;
};

// 卡片骨架屏
export const CardSkeleton: React.FC<{
  showAvatar?: boolean;
  showAction?: boolean;
  lines?: number;
  className?: string;
}> = ({ showAvatar = false, showAction = false, lines = 3, className = '' }) => {
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-6', className)}>
      <div className="space-y-4">
        {showAvatar && (
          <div className="flex items-center space-x-4">
            <Skeleton variant="circular" width={40} height={40} />
            <div className="flex-1">
              <Skeleton width="40%" height={16} className="mb-2" />
              <Skeleton width="60%" height={14} />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Skeleton width="80%" height={20} />
          {Array.from({ length: lines - 1 }).map((_, index) => (
            <Skeleton key={index} width="100%" height={16} />
          ))}
        </div>

        {showAction && (
          <div className="flex justify-end space-x-2">
            <Skeleton width={80} height={32} variant="rounded" />
            <Skeleton width={80} height={32} variant="rounded" />
          </div>
        )}
      </div>
    </div>
  );
};

// 表格骨架屏
export const TableSkeleton: React.FC<{
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}> = ({ rows = 5, columns = 4, showHeader = true, className = '' }) => {
  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 overflow-hidden', className)}>
      {showHeader && (
        <div className="border-b border-gray-200 p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton key={index} height={20} />
            ))}
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  height={16}
                  width={colIndex === 0 ? '60%' : '80%'}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 列表骨架屏
export const ListSkeleton: React.FC<{
  items?: number;
  showAvatar?: boolean;
  lines?: number;
  className?: string;
}> = ({ items = 5, showAvatar = false, lines = 2, className = '' }) => {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-start space-x-4 p-4 bg-white rounded-lg border border-gray-200">
          {showAvatar && (
            <Skeleton variant="circular" width={40} height={40} />
          )}
          <div className="flex-1 space-y-2">
            {Array.from({ length: lines }).map((_, lineIndex) => (
              <Skeleton
                key={lineIndex}
                width={lineIndex === 0 ? '70%' : '100%'}
                height={16}
              />
            ))}
          </div>
          <Skeleton width={24} height={24} variant="rounded" />
        </div>
      ))}
    </div>
  );
};

// 加载动画组件
interface LoadingAnimationProps {
  type?: LoadingType;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
  text?: string;
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  type = 'spinner',
  size = 'md',
  color = 'text-blue-600',
  className = '',
  text
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'lg':
        return 'w-8 h-8';
      default:
        return 'w-6 h-6';
    }
  };

  const renderLoadingIcon = () => {
    const iconSize = getSizeClasses();

    switch (type) {
      case 'spinner':
        return (
          <ArrowPathIcon className={cn(iconSize, color, 'animate-spin')} />
        );

      case 'dots':
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className={cn(
                  'w-2 h-2 rounded-full',
                  color.replace('text', 'bg')
                )}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  delay: index * 0.2,
                }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <div className="relative">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className={cn(
                  'absolute inset-0 rounded-full',
                  color.replace('text', 'bg'),
                  'opacity-30'
                )}
                animate={{
                  scale: [0, 1.5, 2],
                  opacity: [0.5, 0, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.3,
                }}
              />
            ))}
            <div className={cn(iconSize, color, 'relative')} />
          </div>
        );

      case 'wave':
        return (
          <div className="flex space-x-1 items-end">
            {[0, 1, 2, 3, 4].map((index) => (
              <motion.div
                key={index}
                className={cn(
                  'w-1 bg-current rounded-full',
                  index % 2 === 0 ? 'h-4' : 'h-6'
                )}
                style={{ color: color.replace('text-', '') }}
                animate={{
                  scaleY: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: index * 0.1,
                }}
              />
            ))}
          </div>
        );

      default:
        return (
          <ArrowPathIcon className={cn(iconSize, color, 'animate-spin')} />
        );
    }
  };

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      {renderLoadingIcon()}
      {text && (
        <motion.p
          className={cn('mt-2 text-sm', color)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

// 进度条组件
interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  animated?: boolean;
  striped?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  animated = true,
  striped = false,
  className = ''
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-2';
      case 'lg':
        return 'h-6';
      default:
        return 'h-4';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>进度</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={cn(
        'w-full bg-gray-200 rounded-full overflow-hidden',
        getSizeClasses()
      )}>
        <motion.div
          className={cn(
            'h-full rounded-full',
            getVariantClasses(),
            striped && 'bg-gradient-to-r from-transparent via-white/20 to-transparent',
            animated && 'transition-all duration-300 ease-out'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            ...(striped && animated && {
              backgroundSize: '1rem 1rem',
              animation: 'stripes 1s linear infinite',
            })
          }}
        />
      </div>
    </div>
  );
};

// 圆形进度条组件
interface CircularProgressProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 120,
  strokeWidth = 8,
  variant = 'default',
  showLabel = true,
  className = ''
}) => {
  const percentage = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const getVariantColor = () => {
    switch (variant) {
      case 'success':
        return '#10b981';
      case 'warning':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return '#3b82f6';
    }
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* 背景圆 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* 进度圆 */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getVariantColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-gray-900">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
};

// 页面加载组件
interface PageLoadingProps {
  type?: 'spinner' | 'skeleton' | 'dots';
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export const PageLoading: React.FC<PageLoadingProps> = ({
  type = 'spinner',
  message = '加载中...',
  fullScreen = false,
  className = ''
}) => {
  const containerClasses = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-white z-50'
    : 'flex items-center justify-center min-h-[200px]';

  if (type === 'skeleton') {
    return (
      <div className={cn(containerClasses, className)}>
        <div className="w-full max-w-2xl space-y-4">
          <div className="space-y-2">
            <Skeleton width="60%" height={32} />
            <Skeleton width="40%" height={20} />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <CardSkeleton key={index} lines={3} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(containerClasses, className)}>
      <LoadingAnimation
        type={type === 'dots' ? 'dots' : 'spinner'}
        size="lg"
        text={message}
      />
    </div>
  );
};

// 空状态组件
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  const defaultIcon = <DocumentIcon className="w-16 h-16 text-gray-400" />;

  return (
    <div className={cn('text-center py-12', className)}>
      <div className="flex justify-center mb-4">
        {icon || defaultIcon}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 mb-6 max-w-md mx-auto">{description}</p>
      )}
      {action && (
        <motion.button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {action.label}
        </motion.button>
      )}
    </div>
  );
};

// 特定场景的骨架屏
export const ProfileSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={cn('bg-white rounded-lg border border-gray-200 p-6', className)}>
    <div className="flex items-center space-x-6">
      <Skeleton variant="circular" width={80} height={80} />
      <div className="flex-1 space-y-3">
        <Skeleton width="40%" height={24} />
        <Skeleton width="60%" height={16} />
        <Skeleton width="80%" height={14} />
      </div>
    </div>
    <div className="mt-6 grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="text-center">
          <Skeleton width="60%" height={20} className="mx-auto mb-2" />
          <Skeleton width="80%" height={16} className="mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

export const ProductSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={cn('bg-white rounded-lg border border-gray-200 overflow-hidden', className)}>
    <Skeleton width="100%" height={200} />
    <div className="p-4 space-y-3">
      <Skeleton width="80%" height={20} />
      <Skeleton width="60%" height={16} />
      <div className="flex justify-between items-center">
        <Skeleton width="40%" height={24} />
        <Skeleton width={80} height={36} variant="rounded" />
      </div>
    </div>
  </div>
);

// 添加全局样式用于条纹动画
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes stripes {
      0% { background-position: 0 0; }
      100% { background-position: 1rem 0; }
    }
  `;
  document.head.appendChild(style);
}

