'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '~/lib/utils';
import { useRoutePrefetch } from '~/core/routing/RouteTransitionManager';
import { Badge } from '~/core/ui/Badge';

interface SmartNavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  prefetch?: boolean;
  disabled?: boolean;
  external?: boolean;
}

interface SmartNavigationProps {
  items: SmartNavItem[];
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  showActiveIndicator?: boolean;
}

export function SmartNavigation({
  items,
  className,
  orientation = 'horizontal',
  variant = 'default',
  size = 'md',
  showActiveIndicator = true,
}: SmartNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { preloadRoute } = useRoutePrefetch();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // 处理导航点击
  const handleNavClick = (item: SmartNavItem) => {
    if (item.disabled) return;

    if (item.external) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(item.href);
    }
  };

  // 智能预取逻辑
  const handleInteraction = (item: SmartNavItem, isHover: boolean = false) => {
    if (item.disabled || item.external) return;

    // 悬停预取或触摸预取
    if (isHover || item.prefetch) {
      preloadRoute(item.href);
    }
  };

  // 样式配置
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-6 py-3 text-base';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  const getVariantClasses = (isActive: boolean, isHovered: boolean) => {
    const baseClasses = `
      ${getSizeClasses()}
      font-medium
      rounded-lg
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
      flex items-center gap-2
      relative
    `;

    switch (variant) {
      case 'pills':
        return cn(
          baseClasses,
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : isHovered
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          'focus:ring-primary'
        );

      case 'underline':
        return cn(
          baseClasses,
          'rounded-none border-b-2 border-transparent',
          isActive
            ? 'text-primary border-primary'
            : isHovered
            ? 'text-foreground border-muted-foreground/30'
            : 'text-muted-foreground hover:text-foreground',
          'focus:ring-primary'
        );

      default:
        return cn(
          baseClasses,
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : isHovered
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          'focus:ring-accent'
        );
    }
  };

  const containerClasses = cn(
    'flex',
    {
      'flex-row gap-1': orientation === 'horizontal',
      'flex-col gap-2': orientation === 'vertical',
    },
    className
  );

  return (
    <nav className={containerClasses} role="navigation">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const isHovered = hoveredItem === item.href;

        return (
          <div key={item.href} className="relative">
            <Link
              href={item.href}
              className={getVariantClasses(isActive, isHovered)}
              onClick={() => handleNavClick(item)}
              onMouseEnter={() => {
                setHoveredItem(item.href);
                handleInteraction(item, true);
              }}
              onMouseLeave={() => setHoveredItem(null)}
              onFocus={() => handleInteraction(item)}
              onTouchStart={() => handleInteraction(item)}
              prefetch={item.prefetch ? true : false}
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={item.disabled}
            >
              {item.icon && (
                <span className={cn(
                  'transition-transform duration-200',
                  isHovered && 'scale-110'
                )}>
                  {item.icon}
                </span>
              )}

              <span className="truncate">{item.label}</span>

              {item.badge && (
                <Badge
                  variant={isActive ? 'secondary' : 'default'}
                  className={cn(
                    'ml-auto',
                    size === 'sm' ? 'h-4 px-1 text-xs' : 'h-5 px-2 text-xs'
                  )}
                >
                  {item.badge}
                </Badge>
              )}

              {showActiveIndicator && isActive && (
                <div className={cn(
                  'absolute inset-0 rounded-lg bg-primary/10 pointer-events-none',
                  variant === 'underline' && 'border-b-2 border-primary bg-transparent rounded-none'
                )} />
              )}
            </Link>

            {/* 加载指示器 */}
            {isHovered && !item.disabled && (
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent animate-pulse" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// 预定义的导航配置
export const APP_NAVIGATION_ITEMS: SmartNavItem[] = [
  {
    href: '/dashboard',
    label: '仪表板',
    prefetch: true,
  },
  {
    href: '/app/offers',
    label: '广告优惠',
    prefetch: true,
  },
  {
    href: '/app/tasks',
    label: '任务管理',
    prefetch: true,
  },
  {
    href: '/app/adscenter',
    label: '广告中心',
    badge: '新',
  },
];

export const MANAGE_NAVIGATION_ITEMS: SmartNavItem[] = [
  {
    href: '/manage/users',
    label: '用户管理',
    prefetch: false,
  },
  {
    href: '/manage/analytics',
    label: '数据分析',
    prefetch: false,
  },
  {
    href: '/manage/offers',
    label: '优惠管理',
    prefetch: false,
  },
  {
    href: '/manage/subscription-plans',
    label: '订阅计划',
    prefetch: false,
  },
];

export const SETTINGS_NAVIGATION_ITEMS: SmartNavItem[] = [
  {
    href: '/settings/profile',
    label: '个人资料',
    prefetch: false,
  },
  {
    href: '/settings/subscription',
    label: '订阅管理',
    prefetch: false,
  },
  {
    href: '/settings/referral',
    label: '推荐计划',
    prefetch: false,
  },
  {
    href: '/settings/tokens',
    label: 'API令牌',
    prefetch: false,
  },
];

// 面包屑导航组件
interface SmartBreadcrumbProps {
  items: Array<{
    href?: string;
    label: string;
    icon?: React.ReactNode;
  }>;
  className?: string;
}

export function SmartBreadcrumb({ items, className }: SmartBreadcrumbProps) {
  const { preloadRoute } = useRoutePrefetch();

  return (
    <nav className={cn('flex items-center space-x-2 text-sm text-muted-foreground', className)} aria-label="Breadcrumb">
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && (
            <span className="mx-2 text-muted-foreground/50">/</span>
          )}

          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-foreground transition-colors duration-200"
              onMouseEnter={() => preloadRoute(item.href!)}
              onFocus={() => preloadRoute(item.href!)}
            >
              {item.icon && <span className="mr-1">{item.icon}</span>}
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">
              {item.icon && <span className="mr-1">{item.icon}</span>}
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}