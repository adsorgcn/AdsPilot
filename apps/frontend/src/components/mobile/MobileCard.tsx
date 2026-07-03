'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRightIcon, ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

interface MobileCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  expandable?: boolean;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  dismissible?: boolean;
  onDismiss?: () => void;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
}

const MobileCard: React.FC<MobileCardProps> = ({
  children,
  title,
  subtitle,
  expandable = false,
  expanded = false,
  onExpandChange,
  dismissible = false,
  onDismiss,
  onClick,
  className = '',
  variant = 'default',
  size = 'md',
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);

  const handleExpand = () => {
    if (!expandable) return;

    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandChange?.(newExpanded);
  };

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const variantClasses = {
    default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
    elevated: 'bg-white dark:bg-gray-800 shadow-lg',
    outlined: 'bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600',
  };

  return (
    <motion.div
      className={cn(
        'rounded-xl transition-all duration-200',
        sizeClasses[size],
        variantClasses[variant],
        onClick && 'cursor-pointer active:scale-95',
        className
      )}
      onClick={onClick}
      whileTap={{ scale: onClick ? 0.98 : 1 }}
      layout
    >
      {/* 卡片头部 */}
      {(title || expandable || dismissible) && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 ml-4">
            {expandable && (
              <motion.button
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpand();
                }}
                whileTap={{ scale: 0.9 }}
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </motion.div>
              </motion.button>
            )}

            {dismissible && (
              <motion.button
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss?.();
                }}
                whileTap={{ scale: 0.9 }}
              >
                <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </motion.button>
            )}
          </div>
        </div>
      )}

      {/* 卡片内容 */}
      <div className={cn(expandable && 'overflow-hidden')}>
        {children}

        {/* 展开动画内容 */}
        <AnimatePresence>
          {expandable && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                {/* 额外展开内容可以在这里传递 */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// 移动端列表项组件
interface MobileListItemProps {
  children: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  divider?: boolean;
}

export const MobileListItem: React.FC<MobileListItemProps> = ({
  children,
  leading,
  trailing,
  onClick,
  className = '',
  disabled = false,
  divider = true,
}) => {
  return (
    <>
      <motion.button
        className={cn(
          'w-full px-4 py-3 flex items-center gap-3',
          'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700',
          'transition-colors duration-200',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && onClick && 'active:bg-gray-100 dark:active:bg-gray-600',
          className
        )}
        onClick={onClick}
        disabled={disabled}
        whileTap={!disabled && onClick ? { scale: 0.98 } : {}}
      >
        {leading && (
          <div className="flex-shrink-0">
            {leading}
          </div>
        )}

        <div className="flex-1 text-left">
          {children}
        </div>

        {trailing && (
          <div className="flex-shrink-0">
            {trailing}
          </div>
        )}

        {!trailing && onClick && (
          <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
        )}
      </motion.button>

      {divider && (
        <div className="h-px bg-gray-200 dark:bg-gray-700 ml-4" />
      )}
    </>
  );
};

// 移动端标签页组件
interface MobileTabsProps {
  tabs: Array<{
    id: string;
    label: string;
    content: React.ReactNode;
    badge?: number;
  }>;
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

export const MobileTabs: React.FC<MobileTabsProps> = ({
  tabs,
  defaultTab,
  onTabChange,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const currentTab = tabs.find(tab => tab.id === activeTab);

  return (
    <div className={className}>
      {/* 标签页头部 */}
      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <motion.button
              key={tab.id}
              className={cn(
                'flex-1 relative py-2 px-4 rounded-md text-sm font-medium',
                'transition-all duration-200',
                isActive
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
              onClick={() => handleTabChange(tab.id)}
              whileTap={{ scale: 0.95 }}
            >
              {tab.label}

              {/* 徽章 */}
              {tab.badge && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}

              {/* 活跃指示器 */}
              {isActive && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  layoutId="activeTabIndicator"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* 标签页内容 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="mt-4"
        >
          {currentTab?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// 移动端底部抽屉组件
interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  position?: 'bottom' | 'top';
  height?: string | number;
  className?: string;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  children,
  title,
  position = 'bottom',
  height = 'auto',
  className = '',
}) => {
  const isTop = position === 'top';
  const slideDirection = isTop ? 'translateY(-100%)' : 'translateY(100%)';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* 抽屉内容 */}
          <motion.div
            className={cn(
              'fixed left-0 right-0 z-50 bg-white dark:bg-gray-800',
              'max-h-[80vh] overflow-auto',
              position === 'bottom' && 'bottom-0 rounded-t-2xl',
              position === 'top' && 'top-0 rounded-b-2xl',
              className
            )}
            style={{
              height: typeof height === 'number' ? `${height}px` : height,
            }}
            initial={{ transform: slideDirection }}
            animate={{ transform: 'translateY(0)' }}
            exit={{ transform: slideDirection }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* 拖拽指示器 */}
            <div className="flex justify-center py-2">
              <div className="h-1 w-12 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* 标题 */}
            {title && (
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h3>
              </div>
            )}

            {/* 内容 */}
            <div className="p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileCard;