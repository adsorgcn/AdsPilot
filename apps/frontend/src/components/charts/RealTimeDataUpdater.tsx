'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  PauseIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

export interface DataPoint<T = any> {
  timestamp: number;
  value: T;
  id?: string;
}

export interface RealTimeConfig {
  updateInterval: number; // 更新��隔（毫秒）
  maxDataPoints: number; // 最大数据点数量
  autoStart?: boolean; // 是否自动开始
  reconnectAttempts?: number; // 重连尝试次数
  reconnectDelay?: number; // 重连延迟（毫秒）
}

interface RealTimeDataUpdaterProps<T = any> {
  dataSource: () => Promise<DataPoint<T> | DataPoint<T>[]>;
  onDataChange?: (data: DataPoint<T>[]) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  config?: Partial<RealTimeConfig>;
  showControls?: boolean;
  showStatus?: boolean;
  className?: string;
  children?: (data: DataPoint<T>[], controls: RealTimeControls) => React.ReactNode;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface RealTimeControls {
  start: () => void;
  stop: () => void;
  toggle: () => void;
  refresh: () => Promise<void>;
  clear: () => void;
  status: ConnectionStatus;
  isRunning: boolean;
  lastUpdate: Date | null;
}

const defaultConfig: RealTimeConfig = {
  updateInterval: 5000, // 5秒
  maxDataPoints: 50,
  autoStart: true,
  reconnectAttempts: 3,
  reconnectDelay: 2000,
};

const RealTimeDataUpdater = <T = any>({
  dataSource,
  onDataChange,
  onError,
  onStatusChange,
  config = {},
  showControls = true,
  showStatus = true,
  className = '',
  children,
}: RealTimeDataUpdaterProps<T>) => {
  const finalConfig = { ...defaultConfig, ...config };

  const [data, setData] = useState<DataPoint<T>[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const isRunningRef = useRef(false);

  // 数据获取函数
  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setStatus('connecting');
      setError(null);

      const result = await dataSource();

      let newDataPoints: DataPoint<T>[];

      if (Array.isArray(result)) {
        newDataPoints = result.map(point => ({
          ...point,
          timestamp: point.timestamp || Date.now(),
          id: point.id || `data-${point.timestamp || Date.now()}-${Math.random()}`,
        }));
      } else {
        newDataPoints = [{
          ...result,
          timestamp: result.timestamp || Date.now(),
          id: result.id || `data-${result.timestamp || Date.now()}-${Math.random()}`,
        }];
      }

      setData(prevData => {
        const combinedData = [...prevData, ...newDataPoints];
        // 保持数据点数量限制
        return combinedData.slice(-finalConfig.maxDataPoints);
      });

      setStatus('connected');
      setLastUpdate(new Date());
      reconnectCountRef.current = 0;
      onStatusChange?.('connected');

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setStatus('error');
      onError?.(error);
      onStatusChange?.('error');

      // 自动重连
      if (reconnectCountRef.current < (finalConfig.reconnectAttempts ?? 5)) {
        reconnectCountRef.current++;
        setTimeout(() => {
          if (isRunningRef.current) {
            fetchData();
          }
        }, finalConfig.reconnectDelay);
      }
    }
  }, [dataSource, finalConfig, onError, onStatusChange]);

  // 开始更新
  const start = useCallback(() => {
    if (isRunningRef.current) return;

    isRunningRef.current = true;
    fetchData(); // 立即获取一次数据

    // 设置定期更新
    intervalRef.current = setInterval(() => {
      fetchData();
    }, finalConfig.updateInterval);
  }, [fetchData, finalConfig.updateInterval]);

  // 停止更新
  const stop = useCallback(() => {
    isRunningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStatus('disconnected');
    onStatusChange?.('disconnected');
  }, [onStatusChange]);

  // 切换状态
  const toggle = useCallback(() => {
    if (isRunningRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  // 手动刷新
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // 清空数据
  const clear = useCallback(() => {
    setData([]);
    setLastUpdate(null);
    setError(null);
  }, []);

  // 控制对象
  const controls: RealTimeControls = {
    start,
    stop,
    toggle,
    refresh,
    clear,
    status,
    isRunning: isRunningRef.current,
    lastUpdate,
  };

  // 自动启动
  useEffect(() => {
    if (finalConfig.autoStart) {
      start();
    }

    return () => {
      stop();
    };
  }, [finalConfig.autoStart, start, stop]);

  // 数据变化回调
  useEffect(() => {
    onDataChange?.(data);
  }, [data, onDataChange]);

  // 状态指示器组件
  const StatusIndicator = () => {
    if (!showStatus) return null;

    const getStatusInfo = () => {
      switch (status) {
        case 'connecting':
          return {
            color: 'text-yellow-600 dark:text-yellow-400',
            bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
            icon: ArrowPathIcon,
            text: '连接中...',
          };
        case 'connected':
          return {
            color: 'text-green-600 dark:text-green-400',
            bgColor: 'bg-green-100 dark:bg-green-900/20',
            icon: WifiIcon,
            text: '已连接',
          };
        case 'disconnected':
          return {
            color: 'text-gray-600 dark:text-gray-400',
            bgColor: 'bg-gray-100 dark:bg-gray-900/20',
            icon: ArrowsRightLeftIcon,
            text: '已断开',
          };
        case 'error':
          return {
            color: 'text-red-600 dark:text-red-400',
            bgColor: 'bg-red-100 dark:bg-red-900/20',
            icon: ExclamationTriangleIcon,
            text: '连接错误',
          };
        default:
          return {
            color: 'text-gray-600 dark:text-gray-400',
            bgColor: 'bg-gray-100 dark:bg-gray-900/20',
            icon: ArrowsRightLeftIcon,
            text: '未连接',
          };
      }
    };

    const statusInfo = getStatusInfo();
    const Icon = statusInfo.icon;

    return (
      <motion.div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
          statusInfo.bgColor,
          statusInfo.color
        )}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          animate={status === 'connecting' ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Icon className="h-4 w-4" />
        </motion.div>

        <span className="font-medium">{statusInfo.text}</span>

        {lastUpdate && (
          <span className="text-xs opacity-75">
            {lastUpdate.toLocaleTimeString()}
          </span>
        )}

        {error && (
          <AnimatePresence>
            <motion.div
              className="text-xs opacity-75 max-w-xs truncate"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {error.message}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    );
  };

  // 控制按钮组件
  const ControlButtons = () => {
    if (!showControls) return null;

    return (
      <div className="flex items-center gap-2">
        <motion.button
          className={cn(
            'p-2 rounded-lg border transition-colors duration-200',
            isRunningRef.current
              ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
              : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
          )}
          onClick={toggle}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
          title={isRunningRef.current ? '暂停更新' : '开始更新'}
        >
          {isRunningRef.current ? (
            <PauseIcon className="h-4 w-4" />
          ) : (
            <PlayIcon className="h-4 w-4" />
          )}
        </motion.button>

        <motion.button
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
          onClick={refresh}
          disabled={status === 'connecting'}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
          title="手动刷新"
        >
          <ArrowPathIcon className={cn('h-4 w-4', status === 'connecting' && 'animate-spin')} />
        </motion.button>

        <motion.button
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
          onClick={clear}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
          title="清空数据"
        >
          <ArrowsRightLeftIcon className="h-4 w-4" />
        </motion.button>
      </div>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 状态和控制 */}
      {(showControls || showStatus) && (
        <div className="flex items-center justify-between">
          <StatusIndicator />
          <ControlButtons />
        </div>
      )}

      {/* 数据内容 */}
      <AnimatePresence mode="wait">
        {children ? (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {children(data, controls)}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            className="text-center py-12 text-gray-500 dark:text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <ArrowsRightLeftIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>暂无数据</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 数据点计数 */}
      {data.length > 0 && (
        <motion.div
          className="text-xs text-gray-500 dark:text-gray-400 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          数据点: {data.length} / {finalConfig.maxDataPoints}
        </motion.div>
      )}
    </div>
  );
};

// 实时图表包装器
export const RealTimeChart = <T = any>({
  dataSource,
  ChartComponent,
  ...props
}: Omit<RealTimeDataUpdaterProps<T>, 'children'> & {
  ChartComponent: React.ComponentType<{ data: DataPoint<T>[] }>;
}) => {
  return (
    <RealTimeDataUpdater {...props} dataSource={dataSource}>
      {(data) => <ChartComponent data={data} />}
    </RealTimeDataUpdater>
  );
};

export default RealTimeDataUpdater;