'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
  mobileRender?: (item: T) => React.ReactNode;
  hideOnMobile?: boolean;
  primary?: boolean;
}

interface MobileTableViewProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onItemClick?: (item: T) => void;
  expandable?: boolean;
  selectable?: boolean;
  selectedItems?: Set<string>;
  onSelectionChange?: (selectedItems: Set<string>) => void;
  emptyState?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export function MobileTableView<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  onItemClick,
  expandable = false,
  selectable = false,
  selectedItems = new Set(),
  onSelectionChange,
  emptyState,
  loading = false,
  className = '',
}: MobileTableViewProps<T>) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (itemKey: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  const toggleSelection = (itemKey: string) => {
    if (!onSelectionChange) return;
    
    const next = new Set(selectedItems);
    if (next.has(itemKey)) {
      next.delete(itemKey);
    } else {
      next.add(itemKey);
    }
    onSelectionChange(next);
  };

  const primaryColumn = columns.find(col => col.primary) || columns[0];
  const secondaryColumns = columns.filter(col => !col.hideOnMobile && col !== primaryColumn);

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse"
          >
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn('py-12 text-center', className)}>
        {emptyState || (
          <p className="text-gray-500 dark:text-gray-400">No data available</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {data.map((item) => {
        const itemKey = keyExtractor(item);
        const isExpanded = expandedItems.has(itemKey);
        const isSelected = selectedItems.has(itemKey);

        return (
          <motion.div
            key={itemKey}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              'bg-white dark:bg-gray-800 rounded-xl overflow-hidden',
              'border border-gray-200 dark:border-gray-700',
              'transition-all duration-200',
              isSelected && 'ring-2 ring-primary',
              onItemClick && 'active:scale-98'
            )}
          >
            {/* Card Header */}
            <div
              className={cn(
                'p-4 flex items-center gap-3',
                (onItemClick || expandable) && 'cursor-pointer'
              )}
              onClick={() => {
                if (expandable) {
                  toggleExpanded(itemKey);
                } else if (onItemClick) {
                  onItemClick(item);
                }
              }}
            >
              {/* Selection Checkbox */}
              {selectable && (
                <div
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelection(itemKey);
                  }}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center',
                      'transition-all duration-200',
                      isSelected
                        ? 'bg-primary border-primary'
                        : 'border-gray-300 dark:border-gray-600'
                    )}
                  >
                    {isSelected && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              )}

              {/* Primary Content */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white truncate">
                  {primaryColumn.mobileRender
                    ? primaryColumn.mobileRender(item)
                    : primaryColumn.render
                    ? primaryColumn.render(item)
                    : String(item[primaryColumn.key as keyof T])}
                </div>
                
                {/* Secondary Info (collapsed state) */}
                {!isExpanded && secondaryColumns.length > 0 && (
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                    {secondaryColumns[0].mobileRender
                      ? secondaryColumns[0].mobileRender(item)
                      : secondaryColumns[0].render
                      ? secondaryColumns[0].render(item)
                      : String(item[secondaryColumns[0].key as keyof T])}
                  </div>
                )}
              </div>

              {/* Expand Icon */}
              {expandable && (
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0"
                >
                  <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                </motion.div>
              )}

              {/* Arrow Icon */}
              {!expandable && onItemClick && (
                <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              )}
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100 dark:border-gray-700">
                    {secondaryColumns.map((column) => (
                      <div key={String(column.key)} className="flex justify-between items-start">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {column.label}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white text-right ml-4">
                          {column.mobileRender
                            ? column.mobileRender(item)
                            : column.render
                            ? column.render(item)
                            : String(item[column.key as keyof T])}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}