'use client';

import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { TrashIcon, StarIcon } from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

interface SwipeAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
  onAction: () => void;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeThreshold?: number;
  disabled?: boolean;
  className?: string;
}

const defaultLeftAction: SwipeAction = {
  icon: StarIcon,
  label: 'Favorite',
  color: 'text-yellow-600',
  bgColor: 'bg-yellow-50',
  onAction: () => {},
};

const defaultRightAction: SwipeAction = {
  icon: TrashIcon,
  label: 'Delete',
  color: 'text-red-600',
  bgColor: 'bg-red-50',
  onAction: () => {},
};

export function SwipeableCard({
  children,
  leftAction = defaultLeftAction,
  rightAction = defaultRightAction,
  onSwipeLeft,
  onSwipeRight,
  swipeThreshold = 100,
  disabled = false,
  className = '',
}: SwipeableCardProps) {
  const [isSwiping, setIsSwiping] = useState(false);
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const leftActionOpacity = useTransform(x, [0, swipeThreshold], [0, 1]);
  const rightActionOpacity = useTransform(x, [-swipeThreshold, 0], [1, 0]);
  const leftActionScale = useTransform(x, [0, swipeThreshold], [0.5, 1]);
  const rightActionScale = useTransform(x, [-swipeThreshold, 0], [1, 0.5]);

  const handleDragStart = () => {
    if (disabled) return;
    setIsSwiping(true);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
    if (disabled) return;
    
    setIsSwiping(false);
    const currentX = x.get();

    if (currentX >= swipeThreshold) {
      leftAction.onAction();
      onSwipeRight?.();
      x.set(0);
    } else if (currentX <= -swipeThreshold) {
      rightAction.onAction();
      onSwipeLeft?.();
      x.set(0);
    } else {
      x.set(0);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      <motion.div
        className={cn(
          'absolute inset-y-0 left-0 flex items-center justify-start px-6',
          leftAction.bgColor
        )}
        style={{ opacity: leftActionOpacity, width: '100%' }}
      >
        <motion.div
          className="flex flex-col items-center gap-1"
          style={{ scale: leftActionScale }}
        >
          <leftAction.icon className={cn('w-6 h-6', leftAction.color)} />
          <span className={cn('text-xs font-medium', leftAction.color)}>
            {leftAction.label}
          </span>
        </motion.div>
      </motion.div>

      <motion.div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-end px-6',
          rightAction.bgColor
        )}
        style={{ opacity: rightActionOpacity, width: '100%' }}
      >
        <motion.div
          className="flex flex-col items-center gap-1"
          style={{ scale: rightActionScale }}
        >
          <rightAction.icon className={cn('w-6 h-6', rightAction.color)} />
          <span className={cn('text-xs font-medium', rightAction.color)}>
            {rightAction.label}
          </span>
        </motion.div>
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragElastic={0.2}
        dragConstraints={{ left: -swipeThreshold * 1.5, right: swipeThreshold * 1.5 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={cn(
          'relative bg-white dark:bg-gray-800',
          isSwiping && 'cursor-grabbing'
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}