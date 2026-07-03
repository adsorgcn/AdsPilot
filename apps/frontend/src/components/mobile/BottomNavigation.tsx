'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  HomeIcon,
  ChartBarIcon,
  UserIcon,
  Cog6ToothIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { HomeIcon as HomeSolidIcon, ChartBarIcon as ChartBarSolidIcon } from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  activeIcon: React.ComponentType<{ className?: string }>;
  badge?: number;
  disabled?: boolean;
}

interface BottomNavigationProps {
  className?: string;
  hidden?: boolean;
  items?: NavItem[];
  onItemClick?: (item: NavItem) => void;
}

const defaultNavItems: NavItem[] = [
  {
    id: 'home',
    label: '首页',
    href: '/',
    icon: HomeIcon,
    activeIcon: HomeSolidIcon,
  },
  {
    id: 'analytics',
    label: '分析',
    href: '/dashboard',
    icon: ChartBarIcon,
    activeIcon: ChartBarSolidIcon,
  },
  {
    id: 'create',
    label: '创建',
    href: '/create',
    icon: PlusIcon,
    activeIcon: PlusIcon,
  },
  {
    id: 'profile',
    label: '我的',
    href: '/profile',
    icon: UserIcon,
    activeIcon: UserIcon,
  },
  {
    id: 'settings',
    label: '设置',
    href: '/settings',
    icon: Cog6ToothIcon,
    activeIcon: Cog6ToothIcon,
  },
];

const BottomNavigation: React.FC<BottomNavigationProps> = ({
  className = '',
  hidden = false,
  items = defaultNavItems,
  onItemClick,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [activeItem, setActiveItem] = useState<string>(() => {
    return items.find(item => item.href === pathname)?.id || 'home';
  });

  const handleItemClick = (item: NavItem) => {
    if (item.disabled) return;

    setActiveItem(item.id);
    onItemClick?.(item);
    router.push(item.href);
  };

  const isActive = (item: NavItem) => {
    return item.id === activeItem || pathname === item.href;
  };

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50',
            'bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg',
            'border-t border-gray-200 dark:border-slate-700',
            'safe-area-inset-bottom',
            className
          )}
        >
          {/* 底部安全区域适配 */}
          <div className="bg-gradient-to-t from-black/5 dark:from-white/5 h-2" />

          <nav className="flex items-center justify-around px-2 py-2">
            {items.map((item) => {
              const Icon = isActive(item) ? item.activeIcon : item.icon;
              const active = isActive(item);

              return (
                <motion.button
                  key={item.id}
                  className={cn(
                    'relative flex flex-col items-center justify-center py-2 px-3 rounded-lg',
                    'min-w-0 flex-1',
                    'transition-all duration-200',
                    active
                      ? 'text-primary'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                    item.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => handleItemClick(item)}
                  disabled={item.disabled}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: item.disabled ? 1 : 1.05 }}
                >
                  {/* 活跃状态背景 */}
                  {active && (
                    <motion.div
                      className="absolute inset-0 bg-primary/10 rounded-lg"
                      layoutId="activeTab"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}

                  {/* 图标 */}
                  <div className="relative">
                    <Icon className="h-6 w-6" />

                    {/* 徽章 */}
                    {item.badge && item.badge > 0 && (
                      <motion.div
                        className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <span className="text-xs text-white font-medium">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      </motion.div>
                    )}
                  </div>

                  {/* 标签 */}
                  <span className="text-xs mt-1 font-medium truncate">
                    {item.label}
                  </span>

                  {/* 活跃指示器 */}
                  {active && (
                    <motion.div
                      className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                      layoutId="activeIndicator"
                    />
                  )}
                </motion.button>
              );
            })}
          </nav>

          {/* 主页指示器 - iOS风格 */}
          <div className="flex justify-center pb-2">
            <div className="w-32 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 浮动操作按钮版本
interface FloatingActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  children,
  onClick,
  className = '',
  position = 'bottom-right',
  size = 'md',
  disabled = false,
}) => {
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 transform -translate-x-1/2',
  };

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  return (
    <motion.button
      className={cn(
        'fixed z-50 rounded-full bg-primary text-white shadow-lg',
        'flex items-center justify-center',
        'border-2 border-white/20',
        positionClasses[position],
        sizeClasses[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: disabled ? 1 : 1.1 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="relative">
        {children}

        {/* 脉冲效果 */}
        <motion.div
          className="absolute inset-0 rounded-full bg-primary opacity-30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ filter: 'blur(8px)' }}
        />
      </div>
    </motion.button>
  );
};

// 手势提示组件
interface SwipeHintProps {
  visible: boolean;
  direction: 'up' | 'down' | 'left' | 'right';
  className?: string;
}

export const SwipeHint: React.FC<SwipeHintProps> = ({
  visible,
  direction,
  className = '',
}) => {
  const getIcon = () => {
    switch (direction) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'left':
        return '←';
      case 'right':
        return '→';
    }
  };

  const getAnimation = () => {
    switch (direction) {
      case 'up':
        return { y: [0, -10, 0] };
      case 'down':
        return { y: [0, 10, 0] };
      case 'left':
        return { x: [0, -10, 0] };
      case 'right':
        return { x: [0, 10, 0] };
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={cn(
            'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
            'bg-black/70 text-white rounded-full w-12 h-12',
            'flex items-center justify-center text-xl',
            'z-50 pointer-events-none',
            className
          )}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            animate={getAnimation()}
            transition={{ duration: 1, repeat: 2, ease: 'easeInOut' }}
          >
            {getIcon()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BottomNavigation;