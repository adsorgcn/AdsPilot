'use client';

import React, { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '~/lib/utils';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  itemClassName?: string;
  gap?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 80,
  overscan = 5,
  className = '',
  itemClassName = '',
  gap = 0,
  onEndReached,
  endReachedThreshold = 0.8,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const hasCalledEndReached = useRef(false);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    gap,
  });

  const handleScroll = useCallback(() => {
    if (!onEndReached || !parentRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    if (scrollPercentage >= endReachedThreshold && !hasCalledEndReached.current) {
      hasCalledEndReached.current = true;
      onEndReached();
      
      setTimeout(() => {
        hasCalledEndReached.current = false;
      }, 1000);
    }
  }, [onEndReached, endReachedThreshold]);

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            className={itemClassName}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}