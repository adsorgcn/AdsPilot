'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  threshold?: number;
  className?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
  threshold = 80,
  className = '',
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  
  const rotate = useTransform(y, [0, threshold], [0, 360]);
  const opacity = useTransform(y, [0, threshold / 2, threshold], [0, 0.5, 1]);
  const scale = useTransform(y, [0, threshold], [0.5, 1]);

  const handleDragStart = useCallback(() => {
    if (disabled || isRefreshing) return;
    
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 0) return;
    
    setIsPulling(true);
  }, [disabled, isRefreshing]);

  const handleDrag = useCallback((_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled || isRefreshing || !isPulling) return;
    
    if (info.offset.y < 0) {
      y.set(0);
      return;
    }
    
    const resistance = 0.5;
    y.set(info.offset.y * resistance);
  }, [disabled, isRefreshing, isPulling, y]);

  const handleDragEnd = useCallback(async (_event: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
    if (disabled || isRefreshing || !isPulling) return;
    
    setIsPulling(false);
    
    const currentY = y.get();
    
    if (currentY >= threshold) {
      setIsRefreshing(true);
      y.set(threshold);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        y.set(0);
      }
    } else {
      y.set(0);
    }
  }, [disabled, isRefreshing, isPulling, threshold, onRefresh, y]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none"
        style={{ y: y, opacity }}
      >
        <motion.div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-full',
            'bg-white dark:bg-gray-800 shadow-lg',
            isRefreshing && 'animate-spin'
          )}
          style={{ rotate: isRefreshing ? undefined : rotate, scale }}
        >
          <ArrowPathIcon className="w-5 h-5 text-primary" />
        </motion.div>
      </motion.div>

      <motion.div
        drag="y"
        dragDirectionLock
        dragElastic={0}
        dragConstraints={{ top: 0, bottom: 0 }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ y }}
      >
        {children}
      </motion.div>
    </div>
  );
}