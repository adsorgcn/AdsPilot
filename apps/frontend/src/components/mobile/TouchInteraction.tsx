'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { cn } from '~/lib/utils';

// 触摸反馈组件
interface TouchFeedbackProps {
  children: React.ReactNode;
  className?: string;
  feedbackScale?: number;
  feedbackOpacity?: number;
  disabled?: boolean;
  onPress?: () => void;
  onPressEnd?: () => void;
}

export const TouchFeedback: React.FC<TouchFeedbackProps> = ({
  children,
  className = '',
  feedbackScale = 0.95,
  feedbackOpacity = 0.7,
  disabled = false,
  onPress,
  onPressEnd,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePressStart = useCallback(() => {
    if (disabled) return;
    setIsPressed(true);
    onPress?.();

    // 触觉反馈
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, [disabled, onPress]);

  const handlePressEnd = useCallback(() => {
    if (disabled) return;
    setIsPressed(false);
    onPressEnd?.();
  }, [disabled, onPressEnd]);

  return (
    <motion.div
      className={cn('cursor-pointer', className)}
      whileTap={!disabled ? { scale: feedbackScale, opacity: feedbackOpacity } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      style={{ WebkitTapHighlightColor: 'transparent' }} // 移除移动端默认触摸高亮
    >
      {children}

      {/* 触摸反馈覆盖层 */}
      {isPressed && (
        <motion.div
          className="absolute inset-0 bg-black/10 rounded-inherit pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </motion.div>
  );
};

// 可触摸滑动的开关组件
interface TouchSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const TouchSwitch: React.FC<TouchSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-10 h-6',
    md: 'w-12 h-7',
    lg: 'w-14 h-8',
  };

  const thumbSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const thumbTranslateClasses = {
    sm: checked ? 'translate-x-5' : 'translate-x-1',
    md: checked ? 'translate-x-6' : 'translate-x-1',
    lg: checked ? 'translate-x-7' : 'translate-x-1',
  };

  return (
    <TouchFeedback
      disabled={disabled}
      onPress={() => onChange(!checked)}
      className={cn(
        'relative inline-flex rounded-full transition-colors duration-200',
        sizeClasses[size],
        checked
          ? 'bg-primary'
          : 'bg-gray-300 dark:bg-gray-600',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <motion.div
        className={cn(
          'inline-block bg-white rounded-full shadow-sm',
          thumbSizeClasses[size],
          'absolute top-1/2 -translate-y-1/2',
          thumbTranslateClasses[size]
        )}
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      />
    </TouchFeedback>
  );
};

// 触摸感知的滑块组件
interface TouchSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showValue?: boolean;
  className?: string;
}

export const TouchSlider: React.FC<TouchSliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  showValue = true,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const percentage = ((value - min) / (max - min)) * 100;

  const handleSliderChange = useCallback((clientX: number) => {
    if (!containerRef.current || disabled) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const newValue = min + (percentage / 100) * (max - min);
    const steppedValue = Math.round(newValue / step) * step;

    onChange(Math.max(min, Math.min(max, steppedValue)));
  }, [disabled, min, max, step, onChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleSliderChange(e.clientX);
  }, [disabled, handleSliderChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || disabled) return;
    handleSliderChange(e.clientX);
  }, [isDragging, disabled, handleSliderChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={cn('w-full', className)}>
      {showValue && (
        <div className="flex justify-between mb-2 text-sm text-gray-600 dark:text-gray-400">
          <span>{min}</span>
          <span className="font-medium text-primary">{value}</span>
          <span>{max}</span>
        </div>
      )}

      <div
        ref={containerRef}
        className={cn(
          'relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onMouseDown={handleMouseDown}
      >
        {/* 进度条 */}
        <motion.div
          className="absolute left-0 top-0 h-full bg-primary rounded-full"
          style={{ width: `${percentage}%` }}
          transition={{ duration: 0.2 }}
        />

        {/* 滑块 */}
        <motion.div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-primary',
            disabled && 'opacity-50'
          )}
          style={{ left: `calc(${percentage}% - 12px)` }}
          whileTap={{ scale: 1.2 }}
          animate={{
            scale: isDragging ? 1.2 : 1,
          }}
        />

        {/* 触摸优化区域 */}
        <div
          className="absolute inset-0 -top-4 -bottom-4"
          onTouchStart={(e) => {
            const touch = e.touches[0];
            handleSliderChange(touch.clientX);
          }}
          onTouchMove={(e) => {
            if (disabled) return;
            const touch = e.touches[0];
            handleSliderChange(touch.clientX);
          }}
        />
      </div>
    </div>
  );
};

// 手势感知的下拉刷新组件
interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  threshold?: number;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  isRefreshing,
  threshold = 80,
  className = '',
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;

    // 只有向下拉时才响应
    if (distance > 0) {
      setPullDistance(Math.min(distance * 0.5, threshold * 1.5)); // 减少阻力
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      await onRefresh();
    }
    setPullDistance(0);
    setIsPulling(false);
  };

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 下拉指示器 */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex justify-center items-center z-10"
        style={{ height: `${Math.min(pullDistance, threshold)}px` }}
      >
        <div className="flex items-center gap-2 text-primary">
          <motion.div
            animate={{ rotate: isRefreshing ? 360 : 0 }}
            transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: 'linear' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </motion.div>
          {isRefreshing ? (
            <span className="text-sm">刷新中...</span>
          ) : pullDistance >= threshold ? (
            <span className="text-sm">释放刷新</span>
          ) : pullDistance > 0 ? (
            <span className="text-sm">下拉刷新</span>
          ) : null}
        </div>
      </motion.div>

      {/* 内容 */}
      <motion.div
        style={{ transform: `translateY(${pullDistance}px)` }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {children}
      </motion.div>
    </div>
  );
};

// 触摸感知的卡片堆叠组件
interface TouchStackProps {
  cards: Array<{
    id: string;
    content: React.ReactNode;
    onSwipe?: (direction: 'left' | 'right') => void;
  }>;
  onCardChange?: (cardIndex: number) => void;
  className?: string;
}

export const TouchStack: React.FC<TouchStackProps> = ({
  cards,
  onCardChange,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

  const currentCard = cards[currentIndex];

  const handleDragEnd = async (_: any, info: PanInfo) => {
    const threshold = 100;

    if (Math.abs(info.offset.x) > threshold) {
      // 滑动到下一张卡片
      if (info.offset.x > 0) {
        currentCard?.onSwipe?.('right');
      } else {
        currentCard?.onSwipe?.('left');
      }

      setDragOffset(0);
      setTimeout(() => {
        if (currentIndex < cards.length - 1) {
          const newIndex = currentIndex + 1;
          setCurrentIndex(newIndex);
          onCardChange?.(newIndex);
        }
      }, 200);
    } else {
      // 弹回原位
      setDragOffset(0);
    }
  };

  if (currentIndex >= cards.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>没有更多卡片了</p>
      </div>
    );
  }

  return (
    <div className={cn('relative h-96', className)}>
      {/* 背景卡片 */}
      {cards.slice(currentIndex + 1, currentIndex + 3).reverse().map((card, index) => (
        <motion.div
          key={card.id}
          className="absolute inset-0 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
          style={{
            transform: `translateY(${(index + 1) * 8}px) scale(${1 - (index + 1) * 0.05})`,
            zIndex: cards.length - (currentIndex + index + 1),
          }}
        >
          <div className="opacity-50">
            {card.content}
          </div>
        </motion.div>
      ))}

      {/* 当前卡片 */}
      <motion.div
        className="absolute inset-0"
        style={{
          transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.05}deg)`,
          zIndex: cards.length,
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDrag={(_, info) => setDragOffset(info.offset.x)}
        onDragEnd={handleDragEnd}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 h-full">
          {currentCard?.content}
        </div>
      </motion.div>
    </div>
  );
};

export default TouchFeedback;