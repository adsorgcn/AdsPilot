'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayIcon,
  StopIcon,
  ChartBarIcon,
  ClockIcon,
  BoltIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

// 性能分析条目接口
interface PerformanceEntry {
  id: string;
  name: string;
  type: string;
  startTime: number;
  duration: number;
  timestamp: number;
  details?: Record<string, any>;
}

// 函数性能监控装饰器
export const profileFunction = <T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T => {
  return ((...args: any[]) => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    const duration = end - start;

    // 存储性能数据
    if (!window.__performanceProfile) {
      window.__performanceProfile = [];
    }

    window.__performanceProfile.push({
      id: `${Date.now()}-${Math.random()}`,
      name,
      type: 'function',
      startTime: start,
      duration,
      timestamp: Date.now(),
      details: { args }
    });

    return result;
  }) as T;
};

// React Hook 用于性能分析
export const usePerformanceProfiler = (componentName: string) => {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current += 1;
  });

  useEffect(() => {
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime.current;

    if (!window.__performanceProfile) {
      window.__performanceProfile = [];
    }

    window.__performanceProfile.push({
      id: `${Date.now()}-${Math.random()}`,
      name: `${componentName} render #${renderCount.current}`,
      type: 'render',
      startTime: renderStartTime.current,
      duration: renderDuration,
      timestamp: Date.now(),
      details: { renderCount: renderCount.current }
    });
  });
};

// 性能分析器 Hook
export const useProfiler = () => {
  const [isProfiling, setIsProfiling] = useState(false);
  const [entries, setEntries] = useState<PerformanceEntry[]>([]);
  const [filters, setFilters] = useState({
    type: 'all',
    searchTerm: '',
    minDuration: 0
  });

  const startProfiling = useCallback(() => {
    setIsProfiling(true);
    setEntries([]);
    // 清空之前的性能数据
    window.__performanceProfile = [];
  }, []);

  const stopProfiling = useCallback(() => {
    setIsProfiling(false);
    if (window.__performanceProfile) {
      setEntries([...window.__performanceProfile]);
    }
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
    window.__performanceProfile = [];
  }, []);

  const exportData = useCallback(() => {
    const data = {
      timestamp: Date.now(),
      entries: entries,
      summary: generateSummary(entries)
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-profile-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const filteredEntries = React.useMemo(() => {
    return entries.filter(entry => {
      if (filters.type !== 'all' && entry.type !== filters.type) {
        return false;
      }
      if (filters.searchTerm && !entry.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
        return false;
      }
      if (entry.duration < filters.minDuration) {
        return false;
      }
      return true;
    });
  }, [entries, filters]);

  return {
    isProfiling,
    entries: filteredEntries,
    filters,
    setFilters,
    startProfiling,
    stopProfiling,
    clearEntries,
    exportData,
    summary: generateSummary(entries)
  };
};

// 性能数据摘要生成
const generateSummary = (entries: PerformanceEntry[]) => {
  if (entries.length === 0) {
    return {
      totalEntries: 0,
      totalDuration: 0,
      averageDuration: 0,
      slowestEntry: null,
      fastestEntry: null,
      typeBreakdown: {}
    };
  }

  const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);
  const averageDuration = totalDuration / entries.length;
  const slowestEntry = entries.reduce((prev, current) =>
    prev.duration > current.duration ? prev : current
  );
  const fastestEntry = entries.reduce((prev, current) =>
    prev.duration < current.duration ? prev : current
  );

  const typeBreakdown = entries.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalEntries: entries.length,
    totalDuration,
    averageDuration,
    slowestEntry,
    fastestEntry,
    typeBreakdown
  };
};

// 性能条目组件
interface PerformanceEntryComponentProps {
  entry: PerformanceEntry;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const PerformanceEntryComponent: React.FC<PerformanceEntryComponentProps> = ({
  entry,
  isExpanded = false,
  onToggle
}) => {
  const getDurationColor = (duration: number) => {
    if (duration < 10) return 'text-green-600 bg-green-50';
    if (duration < 50) return 'text-yellow-600 bg-yellow-50';
    if (duration < 100) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'function': 'text-blue-600 bg-blue-50',
      'render': 'text-purple-600 bg-purple-50',
      'navigation': 'text-green-600 bg-green-50',
      'network': 'text-indigo-600 bg-indigo-50',
      'user-interaction': 'text-pink-600 bg-pink-50'
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  };

  return (
    <motion.div
      className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onToggle}
      whileHover={{ scale: 1.01 }}
      layout
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            'px-2 py-1 rounded text-xs font-medium',
            getTypeColor(entry.type)
          )}>
            {entry.type.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 truncate">{entry.name}</h4>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span>Start: {entry.startTime.toFixed(2)}ms</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn(
            'px-3 py-1 rounded-full text-sm font-medium',
            getDurationColor(entry.duration)
          )}>
            {entry.duration.toFixed(2)}ms
          </div>
          <ArrowsPointingOutIcon
            className={cn(
              'w-4 h-4 text-gray-400 transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="mt-4 pt-4 border-t border-gray-200"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Entry ID:</span>
                  <span className="ml-2 font-mono text-xs">{entry.id}</span>
                </div>
                <div>
                  <span className="text-gray-600">Duration:</span>
                  <span className="ml-2 font-medium">{entry.duration.toFixed(4)}ms</span>
                </div>
                <div>
                  <span className="text-gray-600">Start Time:</span>
                  <span className="ml-2 font-medium">{entry.startTime.toFixed(4)}ms</span>
                </div>
                <div>
                  <span className="text-gray-600">Timestamp:</span>
                  <span className="ml-2 font-medium">{new Date(entry.timestamp).toISOString()}</span>
                </div>
              </div>
              {entry.details && Object.keys(entry.details).length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Details:</h5>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(entry.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// 主要性能分析器组件
interface PerformanceProfilerProps {
  className?: string;
  autoCapture?: boolean;
  captureInterval?: number;
}

export const PerformanceProfiler: React.FC<PerformanceProfilerProps> = ({
  className = '',
  autoCapture = false,
  captureInterval = 1000
}) => {
  const {
    isProfiling,
    entries,
    filters,
    setFilters,
    startProfiling,
    stopProfiling,
    clearEntries,
    exportData,
    summary
  } = useProfiler();

  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (autoCapture && !isProfiling) {
      startProfiling();
    }
  }, [autoCapture, isProfiling, startProfiling]);

  const toggleEntryExpansion = useCallback((entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  }, []);

  const formatDuration = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'function', label: 'Functions' },
    { value: 'render', label: 'Renders' },
    { value: 'navigation', label: 'Navigation' },
    { value: 'network', label: 'Network' },
    { value: 'user-interaction', label: 'User Interaction' }
  ];

  return (
    <div className={cn('space-y-6', className)}>
      {/* 标题和控制 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChartBarIcon className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900">Performance Profiler</h2>
          {isProfiling && (
            <div className="flex items-center gap-2 text-red-600">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Recording</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            onClick={exportData}
            disabled={entries.length === 0}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            whileHover={{ scale: entries.length > 0 ? 1.05 : 1 }}
            whileTap={{ scale: entries.length > 0 ? 0.95 : 1 }}
          >
            <DocumentArrowDownIcon className="w-4 h-4 inline mr-2" />
            Export
          </motion.button>
          <motion.button
            onClick={clearEntries}
            disabled={entries.length === 0}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            whileHover={{ scale: entries.length > 0 ? 1.05 : 1 }}
            whileTap={{ scale: entries.length > 0 ? 0.95 : 1 }}
          >
            Clear
          </motion.button>
          <motion.button
            onClick={isProfiling ? stopProfiling : startProfiling}
            className={cn(
              'px-4 py-2 rounded-lg transition-colors',
              isProfiling
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isProfiling ? (
              <>
                <StopIcon className="w-4 h-4 inline mr-2" />
                Stop
              </>
            ) : (
              <>
                <PlayIcon className="w-4 h-4 inline mr-2" />
                Start
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* 统计摘要 */}
      {entries.length > 0 && (
        <motion.div
          className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl p-6 text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-semibold mb-4">Performance Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{summary.totalEntries}</div>
              <div className="text-sm opacity-80">Total Entries</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatDuration(summary.totalDuration)}</div>
              <div className="text-sm opacity-80">Total Duration</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatDuration(summary.averageDuration)}</div>
              <div className="text-sm opacity-80">Average Duration</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatDuration(summary.slowestEntry?.duration || 0)}</div>
              <div className="text-sm opacity-80">Slowest Entry</div>
            </div>
          </div>

          {/* 类型分布 */}
          <div className="mt-6">
            <h4 className="font-medium mb-3">Type Distribution</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.typeBreakdown).map(([type, count]) => (
                <div
                  key={type}
                  className="px-3 py-1 bg-white/20 rounded-full text-sm"
                >
                  {type}: {count}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* 过滤器 */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <FunnelIcon className="w-4 h-4" />
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {typeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                placeholder="Search entries..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Duration (ms)
            </label>
            <input
              type="number"
              value={filters.minDuration}
              onChange={(e) => setFilters(prev => ({ ...prev, minDuration: Number(e.target.value) }))}
              min="0"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* 性能条目列表 */}
      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <EyeIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">No performance data</p>
            <p className="text-sm">Start profiling to see performance metrics</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">
                Performance Entries ({entries.length})
              </h3>
              <div className="text-sm text-gray-500">
                Sorted by timestamp (newest first)
              </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {entries.slice().reverse().map((entry) => (
                <PerformanceEntryComponent
                  key={entry.id}
                  entry={entry}
                  isExpanded={expandedEntries.has(entry.id)}
                  onToggle={() => toggleEntryExpansion(entry.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// 性能标记工具
export const PerformanceMark = {
  mark: (name: string) => {
    if (typeof window !== 'undefined' && window.performance) {
      performance.mark(name);
    }
  },

  measure: (name: string, startMark: string, endMark?: string) => {
    if (typeof window !== 'undefined' && window.performance) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        if (measure) {
          if (!window.__performanceProfile) {
            window.__performanceProfile = [];
          }
          window.__performanceProfile.push({
            id: `${Date.now()}-${Math.random()}`,
            name,
            type: 'custom-measure',
            startTime: measure.startTime,
            duration: measure.duration,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.warn('Performance measure failed:', error);
      }
    }
  },

  startTimer: (name: string) => {
    PerformanceMark.mark(`${name}-start`);
  },

  endTimer: (name: string) => {
    PerformanceMark.mark(`${name}-end`);
    PerformanceMark.measure(name, `${name}-start`, `${name}-end`);
  }
};

// 扩展 window 类型
declare global {
  interface Window {
    __performanceProfile?: PerformanceEntry[];
  }
}

export default PerformanceProfiler;