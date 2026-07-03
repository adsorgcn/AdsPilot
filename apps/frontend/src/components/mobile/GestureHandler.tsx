'use client';

import React, { useRef, useState, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';
import type { PanInfo } from 'framer-motion';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';
export type PinchDirection = 'in' | 'out';

interface GestureHandlerProps {
  children: React.ReactNode;
  onSwipe?: (direction: SwipeDirection, info: PanInfo) => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onPinch?: (direction: PinchDirection, scale: number) => void;
  onLongPress?: () => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
  disabled?: boolean;
  className?: string;
}

interface GestureState {
  isActive: boolean;
  isLongPressing: boolean;
  tapCount: number;
  lastTapTime: number;
  initialDistance: number;
  initialScale: number;
}

const GestureHandler: React.FC<GestureHandlerProps> = ({
  children,
  onSwipe,
  onTap,
  onDoubleTap,
  onPinch,
  onLongPress,
  swipeThreshold = 50,
  longPressDelay = 500,
  doubleTapDelay = 300,
  disabled = false,
  className = '',
}) => {
  const [gestureState, setGestureState] = useState<GestureState>({
    isActive: false,
    isLongPressing: false,
    tapCount: 0,
    lastTapTime: 0,
    initialDistance: 0,
    initialScale: 1,
  });

  const controls = useAnimation();
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const doubleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 处理轻触
  const handleTap = useCallback(() => {
    if (disabled) return;

    const now = Date.now();
    const timeSinceLastTap = now - gestureState.lastTapTime;

    if (timeSinceLastTap < doubleTapDelay) {
      // 双触
      setGestureState(prev => ({ ...prev, tapCount: prev.tapCount + 1, lastTapTime: now }));

      if (gestureState.tapCount >= 1) {
        // 触发双触事件
        onDoubleTap?.();
        setGestureState(prev => ({ ...prev, tapCount: 0 }));
        if (doubleTapTimerRef.current) {
          clearTimeout(doubleTapTimerRef.current);
        }
      }
    } else {
      // 单触
      setGestureState(prev => ({ ...prev, tapCount: 1, lastTapTime: now }));

      doubleTapTimerRef.current = setTimeout(() => {
        if (gestureState.tapCount === 1) {
          onTap?.();
        }
        setGestureState(prev => ({ ...prev, tapCount: 0 }));
      }, doubleTapDelay);
    }
  }, [disabled, gestureState.lastTapTime, gestureState.tapCount, onDoubleTap, onTap, doubleTapDelay]);

  // 处理长按
  const handleLongPressStart = useCallback(() => {
    if (disabled) return;

    longPressTimerRef.current = setTimeout(() => {
      setGestureState(prev => ({ ...prev, isLongPressing: true }));
      onLongPress?.();

      // 触觉反馈（如果支持）
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, longPressDelay);
  }, [disabled, onLongPress, longPressDelay]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    setGestureState(prev => ({ ...prev, isLongPressing: false }));
  }, []);

  // 处理滑动手势
  const handleSwipe = useCallback((info: PanInfo) => {
    if (disabled) return;

    const { offset, velocity } = info;
    const threshold = swipeThreshold;

    if (Math.abs(offset.x) > Math.abs(offset.y)) {
      // 水平滑动
      if (Math.abs(offset.x) > threshold || Math.abs(velocity.x) > 500) {
        if (offset.x > 0) {
          onSwipe?.('right', info);
        } else {
          onSwipe?.('left', info);
        }
      }
    } else {
      // 垂直滑动
      if (Math.abs(offset.y) > threshold || Math.abs(velocity.y) > 500) {
        if (offset.y > 0) {
          onSwipe?.('down', info);
        } else {
          onSwipe?.('up', info);
        }
      }
    }
  }, [disabled, onSwipe, swipeThreshold]);

  // 计算两指距离
  const getDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return 0;

    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // 处理捏合手势
  const handlePinch = useCallback((currentDistance: number) => {
    if (disabled || !onPinch) return;

    const scale = currentDistance / gestureState.initialDistance;

    if (scale > 1.1) {
      onPinch('out', scale);
    } else if (scale < 0.9) {
      onPinch('in', scale);
    }
  }, [disabled, gestureState.initialDistance, onPinch]);

  return (
    <motion.div
      ref={containerRef}
      className={`touch-none ${className}`}
      onTap={handleTap}
      onTapStart={handleLongPressStart}
      onTapCancel={handleLongPressEnd}
      onDragEnd={(_, info) => {
        handleSwipe(info);
        handleLongPressEnd();
      }}
      drag={disabled ? false : 'x'}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.1}
      animate={controls}
      onTouchStart={(event) => {
        const touches = event.touches;
        if (touches.length === 2) {
          setGestureState(prev => ({
            ...prev,
            initialDistance: getDistance(touches),
            initialScale: 1,
          }));
        }
      }}
      onTouchMove={(event) => {
        const touches = event.touches;
        if (touches.length === 2 && gestureState.initialDistance > 0) {
          const currentDistance = getDistance(touches);
          handlePinch(currentDistance);
        }
      }}
    >
      {/* 视觉反馈 */}
      {gestureState.isLongPressing && (
        <motion.div
          className="absolute inset-0 bg-primary/10 rounded-lg pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}

      {children}

      {/* 触摸反馈 */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        whileTap={{ opacity: 0.1 }}
        style={{ backgroundColor: 'currentColor' }}
      />
    </motion.div>
  );
};

// 滑动手势检测器 Hook
export const useSwipeGesture = (
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  threshold = 50
) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // 水平滑动
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
    } else {
      // 垂直滑动
      if (Math.abs(deltaY) > threshold) {
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }

    setTouchStart(null);
  }, [touchStart, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
};

// 可滑动卡片组件
interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  className?: string;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  className = '',
}) => {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((_: any, info: PanInfo) => {
    setDragOffset(info.offset.x);
  }, []);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    setIsDragging(false);

    if (info.offset.x > 100) {
      onSwipeRight?.();
    } else if (info.offset.x < -100) {
      onSwipeLeft?.();
    }

    setDragOffset(0);
  }, [onSwipeLeft, onSwipeRight]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* 左侧操作 */}
      {leftAction && (
        <motion.div
          className="absolute left-0 top-0 bottom-0 flex items-center px-4 bg-green-500 text-white"
          initial={{ x: -100 }}
          animate={{ x: dragOffset > 0 ? dragOffset - 100 : -100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {leftAction}
        </motion.div>
      )}

      {/* 右侧操作 */}
      {rightAction && (
        <motion.div
          className="absolute right-0 top-0 bottom-0 flex items-center px-4 bg-red-500 text-white"
          initial={{ x: 100 }}
          animate={{ x: dragOffset < 0 ? dragOffset + 100 : 100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {rightAction}
        </motion.div>
      )}

      {/* 主要内容 */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDrag={handleDrag}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        animate={{ x: dragOffset }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative bg-white dark:bg-gray-800"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default GestureHandler;