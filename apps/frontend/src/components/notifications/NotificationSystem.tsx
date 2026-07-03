'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
  BellIcon,
  XCircleIcon,
  ArrowPathIcon,
  } from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

// 通知类型
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// 通知位置
export type NotificationPosition = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

// 通知基础属性
export interface NotificationProps {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number; // 0表示不自动关闭
  action?: {
    label: string;
    onClick: () => void;
  };
  closable?: boolean;
  icon?: React.ReactNode;
  showProgress?: boolean;
  pauseOnHover?: boolean;
  onClick?: () => void;
  onClose?: () => void;
}

// 通知组件
const NotificationItem: React.FC<{
  notification: NotificationProps;
  onRemove: (id: string) => void;
  position: NotificationPosition;
}> = ({ notification, onRemove, position }) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    id,
    type,
    title,
    message,
    duration = 5000,
    action,
    closable = true,
    icon,
    showProgress = true,
    pauseOnHover = true,
    onClick,
    onClose
  } = notification;

  // 获取通知样式
  const getNotificationStyles = () => {
    const typeStyles = {
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800'
    };

    const iconStyles = {
      success: <CheckCircleIcon className="w-5 h-5 text-green-600" />,
      error: <XCircleIcon className="w-5 h-5 text-red-600" />,
      warning: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />,
      info: <InformationCircleIcon className="w-5 h-5 text-blue-600" />
    };

    return {
      container: typeStyles[type],
      icon: icon || iconStyles[type]
    };
  };

  // 启动计时器
  const startTimer = useCallback(() => {
    if (duration === 0) return;

    let remainingTime = duration;
    const startTime = Date.now();

    // 主计时器
    timerRef.current = setTimeout(() => {
      onRemove(id);
      onClose?.();
    }, remainingTime);

    // 进度条计时器
    if (showProgress) {
      progressTimerRef.current = setInterval(() => {
        if (!isPaused) {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, remainingTime - elapsed);
          const percentage = (remaining / duration) * 100;
          setProgress(percentage);

          if (remaining === 0 && progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
          }
        }
      }, 50);
    }
  }, [duration, id, onRemove, onClose, showProgress, isPaused]);

  // 清除计时器
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
  }, []);

  // 处理鼠标悬停
  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover && duration > 0) {
      setIsPaused(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    }
  }, [pauseOnHover, duration]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover && duration > 0 && isPaused) {
      setIsPaused(false);
      startTimer();
    }
  }, [pauseOnHover, duration, isPaused, startTimer]);

  // 处理关闭
  const handleClose = useCallback(() => {
    clearTimers();
    onRemove(id);
    onClose?.();
  }, [clearTimers, onRemove, id, onClose]);

  // 启动计时器
  useEffect(() => {
    startTimer();
    return clearTimers;
  }, [startTimer, clearTimers]);

  const styles = getNotificationStyles();

  return (
    <motion.div
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm max-w-sm cursor-pointer',
        styles.container
      )}
      initial={{ opacity: 0, x: position.includes('right') ? 100 : position.includes('left') ? -100 : 0, y: position.includes('top') ? -50 : 50 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: position.includes('right') ? 100 : position.includes('left') ? -100 : 0, y: position.includes('top') ? -50 : 50 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      layout
    >
      {/* 图标 */}
      <div className="flex-shrink-0 mt-0.5">
        {styles.icon}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="font-semibold text-sm mb-1">{title}</h4>
        )}
        <p className="text-sm leading-relaxed">{message}</p>

        {/* 操作按钮 */}
        {action && (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
              handleClose();
            }}
            className="mt-2 text-sm font-medium underline hover:no-underline"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {action.label}
          </motion.button>
        )}
      </div>

      {/* 关闭按钮 */}
      {closable && (
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="flex-shrink-0 p-1 rounded-md hover:bg-black/10 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <XMarkIcon className="w-4 h-4" />
        </motion.button>
      )}

      {/* 进度条 */}
      {showProgress && duration > 0 && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-current opacity-30 rounded-b-lg"
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.05, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
};

// 通知管理Hook
export const useNotification = () => {
  const [notifications, setNotifications] = useState<Map<string, NotificationProps>>(new Map());
  const notificationIdRef = useRef(0);

  // 添加通知
  const addNotification = useCallback((notification: Omit<NotificationProps, 'id'>) => {
    const id = `notification-${++notificationIdRef.current}`;
    const newNotification: NotificationProps = { ...notification, id };

    setNotifications(prev => new Map(prev).set(id, newNotification));

    return id;
  }, []);

  // 移除通知
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const newMap = new Map(prev);
      const notification = newMap.get(id);
      if (notification) {
        notification.onClose?.();
        newMap.delete(id);
      }
      return newMap;
    });
  }, []);

  // 清除所有通知
  const clearNotifications = useCallback(() => {
    notifications.forEach(notification => notification.onClose?.());
    setNotifications(new Map());
  }, [notifications]);

  // 便捷方法
  const success = useCallback((message: string, options?: Partial<Omit<NotificationProps, 'id' | 'type' | 'message'>>) => {
    return addNotification({ type: 'success', message, ...options });
  }, [addNotification]);

  const error = useCallback((message: string, options?: Partial<Omit<NotificationProps, 'id' | 'type' | 'message'>>) => {
    return addNotification({ type: 'error', message, ...options });
  }, [addNotification]);

  const warning = useCallback((message: string, options?: Partial<Omit<NotificationProps, 'id' | 'type' | 'message'>>) => {
    return addNotification({ type: 'warning', message, ...options });
  }, [addNotification]);

  const info = useCallback((message: string, options?: Partial<Omit<NotificationProps, 'id' | 'type' | 'message'>>) => {
    return addNotification({ type: 'info', message, ...options });
  }, [addNotification]);

  return {
    notifications: Array.from(notifications.values()),
    addNotification,
    removeNotification,
    clearNotifications,
    success,
    error,
    warning,
    info,
    count: notifications.size
  };
};

// 进度通知属性
export interface ProgressNotificationProps {
  id: string;
  title: string;
  progress: number; // 0-100
  status?: 'loading' | 'success' | 'error';
  message?: string;
  onCancel?: () => void;
  onComplete?: () => void;
}

// 进度通知组件
export const ProgressNotification: React.FC<ProgressNotificationProps> = ({
  id: _id,
  title,
  progress,
  status = 'loading',
  message,
  onCancel,
  onComplete
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-600" />;
      default:
        return <ArrowPathIcon className="w-5 h-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  useEffect(() => {
    if (progress >= 100 && status === 'loading') {
      onComplete?.();
    }
  }, [progress, status, onComplete]);

  return (
    <motion.div
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm max-w-sm',
        getStatusColor()
      )}
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getStatusIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm mb-1">{title}</h4>
        {message && (
          <p className="text-sm text-gray-600 mb-2">{message}</p>
        )}

        {/* 进度条 */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>进度</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-blue-600 rounded-full h-2"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* 取消按钮 */}
        {status === 'loading' && onCancel && (
          <motion.button
            onClick={onCancel}
            className="mt-2 text-sm text-gray-600 hover:text-gray-800"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            取消
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

// 进度通知管理Hook
export const useProgressNotification = () => {
  const [progressNotifications, setProgressNotifications] = useState<Map<string, ProgressNotificationProps>>(new Map());
  const notificationIdRef = useRef(0);

  // 创建进度通知
  const createProgress = useCallback((title: string, options?: Partial<Omit<ProgressNotificationProps, 'id' | 'title' | 'progress'>>) => {
    const id = `progress-${++notificationIdRef.current}`;
    const newNotification: ProgressNotificationProps = {
      id,
      title,
      progress: 0,
      ...options
    };

    setProgressNotifications(prev => new Map(prev).set(id, newNotification));
    return id;
  }, []);

  // 更新进度
  const updateProgress = useCallback((id: string, progress: number, updates?: Partial<ProgressNotificationProps>) => {
    setProgressNotifications(prev => {
      const newMap = new Map(prev);
      const notification = newMap.get(id);
      if (notification) {
        newMap.set(id, { ...notification, progress, ...updates });
      }
      return newMap;
    });
  }, []);

  // 完成进度
  const completeProgress = useCallback((id: string, status: 'success' | 'error' = 'success', message?: string) => {
    setProgressNotifications(prev => {
      const newMap = new Map(prev);
      const notification = newMap.get(id);
      if (notification) {
        newMap.set(id, {
          ...notification,
          progress: 100,
          status,
          message
        });
      }
      return newMap;
    });

    // 3秒后自动移除
    setTimeout(() => {
      removeProgress(id);
    }, 3000);
  }, []);

  // 移除进度通知
  const removeProgress = useCallback((id: string) => {
    setProgressNotifications(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  return {
    progressNotifications: Array.from(progressNotifications.values()),
    createProgress,
    updateProgress,
    completeProgress,
    removeProgress
  };
};

// 批量通知管理组件
export const BatchNotificationManager: React.FC<{
  notifications: NotificationProps[];
  position?: NotificationPosition;
  maxVisible?: number;
  onRemove: (id: string) => void;
}> = ({ notifications, position = 'top-right', maxVisible = 5, onRemove }) => {
  const visibleNotifications = notifications.slice(-maxVisible);

  const getPositionStyles = () => {
    const positions = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'top-center': 'top-4 left-1/2 -translate-x-1/2',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2'
    };
    return positions[position];
  };

  const getDirectionStyles = () => {
    if (position.includes('right')) return 'items-end';
    if (position.includes('left')) return 'items-start';
    return 'items-center';
  };

  return (
    <div className={cn('fixed z-50 flex flex-col gap-2 pointer-events-none', getPositionStyles(), getDirectionStyles())}>
      <AnimatePresence mode="popLayout">
        {visibleNotifications.map((notification) => (
          <div key={notification.id} className="pointer-events-auto">
            <NotificationItem
              notification={notification}
              onRemove={onRemove}
              position={position}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// 通知中心组件
export const NotificationCenter: React.FC<{
  className?: string;
  showToggle?: boolean;
  defaultPosition?: NotificationPosition;
}> = ({ className = '', showToggle = true, defaultPosition = 'top-right' }) => {
  const {
    notifications,
    removeNotification,
    clearNotifications
  } = useNotification();

  const [showNotifications, setShowNotifications] = useState(false);
  const [position, setPosition] = useState<NotificationPosition>(defaultPosition);

  return (
    <div className={cn('relative', className)}>
      {/* 通知渲染器 */}
      <BatchNotificationManager
        notifications={notifications}
        position={position}
        onRemove={removeNotification}
      />

      {/* 通知中心切换按钮 */}
      {showToggle && (
        <motion.button
          onClick={() => setShowNotifications(!showNotifications)}
          className="fixed bottom-4 right-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-40"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <BellIcon className="w-6 h-6" />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {notifications.length > 99 ? '99+' : notifications.length}
            </span>
          )}
        </motion.button>
      )}

      {/* 通知中心面板 */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNotifications(false)}
          >
            <motion.div
              className="absolute right-4 top-4 w-96 max-h-[80vh] bg-white rounded-lg shadow-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, x: 100 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 100 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 头部 */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">通知中心</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value as NotificationPosition)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="top-right">右上</option>
                    <option value="top-left">左上</option>
                    <option value="bottom-right">右下</option>
                    <option value="bottom-left">左下</option>
                  </select>
                  <motion.button
                    onClick={clearNotifications}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* 通知列表 */}
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <BellIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无通知</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        {notification.type === 'success' && <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />}
                        {notification.type === 'error' && <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />}
                        {notification.type === 'warning' && <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0" />}
                        {notification.type === 'info' && <InformationCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />}

                        <div className="flex-1 min-w-0">
                          {notification.title && (
                            <h4 className="font-medium text-sm text-gray-900">{notification.title}</h4>
                          )}
                          <p className="text-sm text-gray-600">{notification.message}</p>
                        </div>

                        <button
                          onClick={() => removeNotification(notification.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;