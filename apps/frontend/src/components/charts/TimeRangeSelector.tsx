'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

export type TimeRange =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'last90days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'lastYear'
  | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

interface TimeRangeOption {
  value: TimeRange;
  label: string;
  shortLabel?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange, dateRange?: DateRange) => void;
  options?: TimeRangeOption[];
  showCustomDatePicker?: boolean;
  compact?: boolean;
  variant?: 'default' | 'pills' | 'dropdown';
  className?: string;
  disabled?: boolean;
}

const defaultOptions: TimeRangeOption[] = [
  {
    value: 'today',
    label: '今天',
    shortLabel: '今日',
    description: '从今日开始到当前时间',
    icon: ClockIcon,
  },
  {
    value: 'yesterday',
    label: '昨天',
    shortLabel: '昨日',
    description: '昨天的完整24小时',
  },
  {
    value: 'last7days',
    label: '最近7天',
    shortLabel: '7天',
    description: '包括今天的过去7天',
  },
  {
    value: 'last30days',
    label: '最近30天',
    shortLabel: '30天',
    description: '包括今天的过去30天',
  },
  {
    value: 'last90days',
    label: '最近90天',
    shortLabel: '90天',
    description: '包括今天的过去90天',
  },
  {
    value: 'thisMonth',
    label: '本月',
    shortLabel: '本月',
    description: '从本月1日到现在',
    icon: CalendarIcon,
  },
  {
    value: 'lastMonth',
    label: '上月',
    shortLabel: '上月',
    description: '上个月的完整月份',
  },
  {
    value: 'thisYear',
    label: '今年',
    shortLabel: '今年',
    description: '从1月1日到现在',
  },
  {
    value: 'lastYear',
    label: '去年',
    shortLabel: '去年',
    description: '去年的完整年份',
  },
  {
    value: 'custom',
    label: '自定义',
    shortLabel: '自定义',
    description: '选择自定义日期范围',
    icon: CalendarIcon,
  },
];

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  options = defaultOptions,
  showCustomDatePicker = true,
  compact = false,
  variant = 'default',
  className = '',
  disabled = false,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 获取当前选项
  const currentOption = useMemo(() => {
    return options.find(option => option.value === value);
  }, [value, options]);

  // 计算日期范围
  const getDateRange = (range: TimeRange): DateRange => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
      case 'today':
        return {
          start: new Date(today.setHours(0, 0, 0, 0)),
          end: now,
        };

      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          start: new Date(yesterday.setHours(0, 0, 0, 0)),
          end: new Date(yesterday.setHours(23, 59, 59, 999)),
        };

      case 'last7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        return {
          start: new Date(sevenDaysAgo.setHours(0, 0, 0, 0)),
          end: now,
        };

      case 'last30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        return {
          start: new Date(thirtyDaysAgo.setHours(0, 0, 0, 0)),
          end: now,
        };

      case 'last90days':
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
        return {
          start: new Date(ninetyDaysAgo.setHours(0, 0, 0, 0)),
          end: now,
        };

      case 'thisMonth':
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          start: firstDayOfMonth,
          end: now,
        };

      case 'lastMonth':
        const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          start: firstDayOfLastMonth,
          end: new Date(lastDayOfLastMonth.setHours(23, 59, 59, 999)),
        };

      case 'thisYear':
        const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
        return {
          start: firstDayOfYear,
          end: now,
        };

      case 'lastYear':
        const firstDayOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
        const lastDayOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
        return {
          start: firstDayOfLastYear,
          end: new Date(lastDayOfLastYear.setHours(23, 59, 59, 999)),
        };

      default:
        return {
          start: today,
          end: now,
        };
    }
  };

  // 格式化日期范围显示
  const formatDateRange = (range: TimeRange): string => {
    const dateRange = getDateRange(range);
    const start = dateRange.start;
    const end = dateRange.end;

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
      });
    };

    if (range === 'today' || range === 'yesterday') {
      return formatDate(start);
    }

    // 如果是同一年，不显示年份
    if (start.getFullYear() === end.getFullYear()) {
      return `${formatDate(start)} - ${formatDate(end)}`;
    }

    // 不同年份，显示年份
    const formatFullDate = (date: Date) => {
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    return `${formatFullDate(start)} - ${formatFullDate(end)}`;
  };

  // 处理选择变更
  const handleSelectionChange = (range: TimeRange) => {
    if (range === 'custom' && showCustomDatePicker) {
      setIsDropdownOpen(false);
      // 这里可以打开自定义日期选择器
      return;
    }

    const dateRange = getDateRange(range);
    onChange(range, dateRange);
    setIsDropdownOpen(false);
  };

  // 渲染默认版本
  const renderDefaultVariant = () => (
    <div className={cn('relative', className)}>
      <motion.button
        className={cn(
          'flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm',
          'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
        disabled={disabled}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
      >
        {currentOption?.icon && (
          <currentOption.icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        )}

        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {currentOption?.label || '选择时间范围'}
        </span>

        {!compact && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDateRange(value)}
          </span>
        )}

        <motion.div
          animate={{ rotate: isDropdownOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRightIcon className="h-4 w-4 text-gray-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isDropdownOpen && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              className="fixed inset-0 z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDropdownOpen(false)}
            />

            {/* 下拉面板 */}
            <motion.div
              className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="max-h-80 overflow-y-auto">
                {options.map((option, index) => (
                  <motion.button
                    key={option.value}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                      'first:rounded-t-lg last:rounded-b-lg',
                      value === option.value && 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    )}
                    onClick={() => handleSelectionChange(option.value)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                  >
                    {option.icon && (
                      <option.icon className="h-4 w-4 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {option.label}
                      </div>
                      {option.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {option.description}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateRange(option.value)}
                    </div>

                    {value === option.value && (
                      <motion.div
                        className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  // 渲染药丸版本
  const renderPillsVariant = () => (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.slice(0, compact ? 5 : options.length).map((option) => (
        <motion.button
          key={option.value}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-200',
            value === option.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onClick={() => !disabled && handleSelectionChange(option.value)}
          disabled={disabled}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
          whileHover={{ scale: disabled ? 1 : 1.05 }}
        >
          {option.shortLabel || option.label}
        </motion.button>
      ))}

      {!compact && options.length > 5 && (
        <motion.button
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
            'hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200'
          )}
          onClick={() => setIsDropdownOpen(true)}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
        >
          更多
        </motion.button>
      )}
    </div>
  );

  // 渲染下拉版本
  const renderDropdownVariant = () => (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => handleSelectionChange(e.target.value as TimeRange)}
        disabled={disabled}
        className={cn(
          'w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg',
          'text-sm font-medium text-gray-900 dark:text-white',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  // 根据变体渲染不同版本
  switch (variant) {
    case 'pills':
      return renderPillsVariant();
    case 'dropdown':
      return renderDropdownVariant();
    default:
      return renderDefaultVariant();
  }
};

// 快速时间选择器组件
interface QuickTimeRangeSelectorProps {
  onRangeChange: (range: DateRange) => void;
  className?: string;
}

export const QuickTimeRangeSelector: React.FC<QuickTimeRangeSelectorProps> = ({
  onRangeChange,
  className = '',
}) => {
  const quickRanges = [
    { label: '今日', range: 'today' as TimeRange },
    { label: '本周', range: 'last7days' as TimeRange },
    { label: '本月', range: 'thisMonth' as TimeRange },
  ];

  return (
    <div className={cn('flex gap-2', className)}>
      {quickRanges.map(({ label, range }) => (
        <motion.button
          key={range}
          className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          onClick={() => {
            // Handle quick range selection
            if (range === 'today' || range === 'yesterday' || range === 'last7days' || range === 'last30days' || range === 'last90days') {
              const days = range === 'today' ? 1 : range === 'yesterday' ? 1 : range === 'last7days' ? 7 : range === 'last30days' ? 30 : 90;
              const endDate = new Date();
              const startDate = new Date();
              startDate.setDate(endDate.getDate() - days);
              onRangeChange({ start: startDate, end: endDate });
            }
          }}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
        >
          {label}
        </motion.button>
      ))}
    </div>
  );
};

export default TimeRangeSelector;