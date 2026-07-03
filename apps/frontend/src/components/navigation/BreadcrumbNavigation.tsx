'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRightIcon,
  HomeIcon,
  EllipsisHorizontalIcon,
  FolderIcon,
  DocumentIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  ArrowPathIcon,
  CubeIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

// 面包屑项类型
export interface BreadcrumbItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  isDropdown?: boolean;
  children?: BreadcrumbItem[];
}

// 面包屑导航属性
interface BreadcrumbNavigationProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  maxItems?: number;
  showHome?: boolean;
  showDropdown?: boolean;
  className?: string;
  onItemClick?: (item: BreadcrumbItem) => void;
}

// 单个面包屑项组件
const BreadcrumbItemComponent: React.FC<{
  item: BreadcrumbItem;
  isLast: boolean;
  onClick?: (item: BreadcrumbItem) => void;
}> = ({ item, isLast, onClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleClick = useCallback(() => {
    if (item.children && item.children.length > 0) {
      setIsDropdownOpen(!isDropdownOpen);
    } else if (item.href) {
      window.location.href = item.href;
    }
    onClick?.(item);
  }, [item, isDropdownOpen, onClick]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <div className="relative flex items-center">
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer',
          'hover:bg-gray-100',
          item.isActive && 'bg-blue-50 text-blue-700'
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-haspopup={item.children && item.children.length > 0}
        aria-expanded={isDropdownOpen}
      >
        {item.icon && (
          <span className="flex-shrink-0 w-4 h-4">{item.icon}</span>
        )}
        <span className={cn(
          'text-sm font-medium truncate max-w-[150px]',
          isLast ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'
        )}>
          {item.label}
        </span>
        {item.children && item.children.length > 0 && (
          <ChevronRightIcon className={cn(
            'w-4 h-4 transition-transform',
            isDropdownOpen && 'rotate-90'
          )} />
        )}
      </div>

      {/* 下拉菜单 */}
      <AnimatePresence>
        {isDropdownOpen && item.children && item.children.length > 0 && (
          <>
            <motion.div
              className="fixed inset-0 z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDropdownOpen(false)}
            />
            <motion.div
              className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {item.children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    if (child.href) {
                      window.location.href = child.href;
                    }
                  }}
                >
                  {child.icon && (
                    <span className="flex-shrink-0 w-4 h-4">{child.icon}</span>
                  )}
                  <span className="text-sm text-gray-700">{child.label}</span>
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// 面包屑导航组件
export const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  items,
  separator = <ChevronRightIcon className="w-4 h-4 text-gray-400" />,
  maxItems = 5,
  showHome = true,
  // @ts-expect-error - unused prop
  showDropdown = true,
  className = '',
  onItemClick
}) => {
  const [visibleItems, setVisibleItems] = useState<BreadcrumbItem[]>([]);
  const [_hasOverflow, setHasOverflow] = useState(false);

  // 处理面包屑截断
  useEffect(() => {
    if (items.length <= maxItems) {
      setVisibleItems(items);
      setHasOverflow(false);
    } else {
      // 显示第一项、省略号、最后两项
      const firstItem = items[0];
      const lastTwoItems = items.slice(-2);
      const overflowItems = items.slice(1, -2);

      const truncatedItems = [
        firstItem,
        {
          id: 'overflow',
          label: '...',
          isDropdown: true,
          children: overflowItems,
          icon: <EllipsisHorizontalIcon className="w-4 h-4" />
        },
        ...lastTwoItems
      ];

      setVisibleItems(truncatedItems);
      setHasOverflow(true);
    }
  }, [items, maxItems]);

  return (
    <nav className={cn('flex items-center space-x-2', className)} aria-label="面包屑导航">
      {/* 首页链接 */}
      {showHome && (
        <>
          <motion.a
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <HomeIcon className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">首页</span>
          </motion.a>
          {separator}
        </>
      )}

      {/* 面包屑项 */}
      <AnimatePresence mode="popLayout">
        {visibleItems.map((item, index) => (
          <React.Fragment key={item.id}>
            <BreadcrumbItemComponent
              item={item}
              isLast={index === visibleItems.length - 1}
              onClick={onItemClick}
            />
            {index < visibleItems.length - 1 && (
              <motion.div
                key={`separator-${item.id}`}
                className="flex items-center text-gray-400"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                {separator}
              </motion.div>
            )}
          </React.Fragment>
        ))}
      </AnimatePresence>
    </nav>
  );
};

// 路径历史管理Hook
export const useBreadcrumbHistory = () => {
  const [history, setHistory] = useState<BreadcrumbItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const addPath = useCallback((item: BreadcrumbItem) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(item);
      return newHistory;
    });
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex]);

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      return history[currentIndex - 1];
    }
    return null;
  }, [currentIndex, history]);

  const goForward = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return history[currentIndex + 1];
    }
    return null;
  }, [currentIndex, history]);

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;

  return {
    history,
    currentIndex,
    addPath,
    goBack,
    goForward,
    canGoBack,
    canGoForward
  };
};

// 智能面包屑生成器
export const useSmartBreadcrumb = (currentPath: string) => {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  useEffect(() => {
    const pathSegments = currentPath.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];

    // 添加首页
    items.push({
      id: 'home',
      label: '首页',
      href: '/',
      icon: <HomeIcon className="w-4 h-4" />
    });

    // 构建路径
    let currentHref = '';
    pathSegments.forEach((segment, index) => {
      currentHref += `/${segment}`;

      // 尝试从路由配置获取标签
      const label = getSegmentLabel(segment);

      items.push({
        id: `segment-${index}`,
        label,
        href: currentHref,
        icon: getSegmentIcon(segment, index),
        isActive: index === pathSegments.length - 1
      });
    });

    setBreadcrumbs(items);
  }, [currentPath]);

  return { breadcrumbs };
};

// 路径段标签获取函数
const getSegmentLabel = (segment: string): string => {
  // 常见路径段的中文映射
  const segmentMap: Record<string, string> = {
    'dashboard': '仪表板',
    'settings': '设置',
    'profile': '个人资料',
    'analytics': '分析',
    'reports': '报告',
    'users': '用户',
    'products': '产品',
    'orders': '订单',
    'inventory': '库存',
    'finance': '财务',
    'marketing': '营销',
    'support': '支持',
    'help': '帮助',
    'admin': '管理',
    'edit': '编辑',
    'create': '创建',
    'details': '详情',
    'list': '列表',
    'search': '搜索',
    'notifications': '通知',
    'messages': '消息'
  };

  // 数字ID的处理
  if (/^\d+$/.test(segment)) {
    return `#${segment}`;
  }

  // UUID的处理
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return segment.substring(0, 8) + '...';
  }

  return segmentMap[segment] || decodeURIComponent(segment).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// 路径段图标获取函数
const getSegmentIcon = (segment: string, _index: number): React.ReactNode => {
  const iconMap: Record<string, React.ReactNode> = {
    'dashboard': <DocumentIcon className="w-4 h-4" />,
    'settings': <CogIcon className="w-4 h-4" />,
    'profile': <UserIcon className="w-4 h-4" />,
    'analytics': <ChartBarIcon className="w-4 h-4" />,
    'reports': <DocumentIcon className="w-4 h-4" />,
    'users': <UsersIcon className="w-4 h-4" />,
    'products': <CubeIcon className="w-4 h-4" />,
    'orders': <ShoppingCartIcon className="w-4 h-4" />,
    'inventory': <CubeIcon className="w-4 h-4" />,
    'finance': <CurrencyDollarIcon className="w-4 h-4" />,
    'marketing': <MegaphoneIcon className="w-4 h-4" />,
    'support': <QuestionMarkCircleIcon className="w-4 h-4" />,
    'search': <MagnifyingGlassIcon className="w-4 h-4" />,
    'notifications': <BellIcon className="w-4 h-4" />,
    'messages': <ChatBubbleLeftRightIcon className="w-4 h-4" />
  };

  return iconMap[segment] || <FolderIcon className="w-4 h-4" />;
};

// 高级面包屑导航组件
export const AdvancedBreadcrumb: React.FC<BreadcrumbNavigationProps & {
  showSearch?: boolean;
  showHistory?: boolean;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}> = ({
  items = [],
  showSearch = false,
  showHistory = false,
  onSearch,
  searchPlaceholder = '搜索...',
  ...props
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const { goBack, goForward, canGoBack, canGoForward } = useBreadcrumbHistory();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <div className="flex items-center justify-between">
      <BreadcrumbNavigation items={items} {...props} />

      <div className="flex items-center gap-3">
        {/* 历史导航 */}
        {showHistory && (
          <div className="flex items-center gap-1">
            <motion.button
              onClick={goBack}
              disabled={!canGoBack}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 transition-colors"
              whileHover={canGoBack ? { scale: 1.05 } : {}}
              whileTap={canGoBack ? { scale: 0.95 } : {}}
              title="后退"
            >
              <ArrowPathIcon className="w-4 h-4 rotate-180" />
            </motion.button>
            <motion.button
              onClick={goForward}
              disabled={!canGoForward}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 transition-colors"
              whileHover={canGoForward ? { scale: 1.05 } : {}}
              whileTap={canGoForward ? { scale: 0.95 } : {}}
              title="前进"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </motion.button>
          </div>
        )}

        {/* 搜索 */}
        {showSearch && (
          <div className="relative">
            <AnimatePresence mode="wait">
              {!showSearchInput ? (
                <motion.button
                  key="search-button"
                  onClick={() => setShowSearchInput(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <MagnifyingGlassIcon className="w-4 h-4" />
                </motion.button>
              ) : (
                <motion.div
                  key="search-input"
                  className="relative"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-64 px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setShowSearchInput(false);
                      setSearchQuery('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

// 面包屑搜索组件
export const BreadcrumbSearch: React.FC<{
  onSearch: (query: string) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}> = ({
  onSearch,
  suggestions = [],
  placeholder = '搜索页面...',
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (query && suggestions.length > 0) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [query, suggestions]);

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    onSearch(searchQuery);
    setShowSuggestions(false);
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(filteredSuggestions.length > 0)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => handleSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 搜索建议 */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleSearch(suggestion)}
              >
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{suggestion}</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 缺少的一些图标组件
const CogIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const ChartBarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ShoppingCartIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const CurrencyDollarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const MegaphoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
  </svg>
);

const QuestionMarkCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BellIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const XMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// 导出所有图标组件
export {
  CogIcon,
  UserIcon,
  ChartBarIcon,
  UsersIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  MegaphoneIcon,
  QuestionMarkCircleIcon,
  BellIcon,
  XMarkIcon
};

export default BreadcrumbNavigation;