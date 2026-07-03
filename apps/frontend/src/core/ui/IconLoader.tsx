'use client';

import dynamic from 'next/dynamic';
import { ComponentType, SVGProps } from 'react';

/**
 * ✅ 图标懒加载器 - 减少首屏图标包体积
 *
 * 使用方式:
 * <Icon name="User" className="h-5 w-5" />
 * <Icon name="Settings" className="h-6 w-6" />
 */

// 预定义的常用图标映射
const iconMap: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  // 用户相关
  User: dynamic(() => import('lucide-react').then(mod => ({ default: mod.User })), { ssr: false }),
  Settings: dynamic(() => import('lucide-react').then(mod => ({ default: mod.Settings })), { ssr: false }),

  // 导航相关
  Menu: dynamic(() => import('lucide-react').then(mod => ({ default: mod.Menu })), { ssr: false }),
  X: dynamic(() => import('lucide-react').then(mod => ({ default: mod.X })), { ssr: false }),

  // 业务相关
  CreditCard: dynamic(() => import('lucide-react').then(mod => ({ default: mod.CreditCard })), { ssr: false }),
  Wallet: dynamic(() => import('lucide-react').then(mod => ({ default: mod.Wallet })), { ssr: false }),
  Gift: dynamic(() => import('lucide-react').then(mod => ({ default: mod.Gift })), { ssr: false }),
  CalendarDays: dynamic(() => import('lucide-react').then(mod => ({ default: mod.CalendarDays })), { ssr: false }),

  // 状态相关
  CheckCircle: dynamic(() => import('lucide-react').then(mod => ({ default: mod.CheckCircle })), { ssr: false }),
  Clock: dynamic(() => import('lucide-react').then(mod => ({ default: mod.Clock })), { ssr: false }),
  TrendingUp: dynamic(() => import('lucide-react').then(mod => ({ default: mod.TrendingUp })), { ssr: false }),

  // 通用
  Plus: dynamic(() => import('lucide-react').then(mod => ({ default: mod.Plus })), { ssr: false }),
  Eye: dynamic(() => import('lucide-react').then(mod => ({ default: mod.Eye })), { ssr: false }),
  Trash2: dynamic(() => import('lucide-react').then(mod => ({ default: mod.Trash2 })), { ssr: false }),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: keyof typeof iconMap;
  fallback?: ComponentType<SVGProps<SVGSVGElement>>;
}

export function Icon({ name, fallback: Fallback, className = "h-5 w-5", ...props }: IconProps) {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    if (Fallback) {
      return <Fallback className={className} {...props} />;
    }

    // 返回默认占位符
    return (
      <div
        className={`inline-flex items-center justify-center rounded bg-muted text-muted-foreground ${className}`}
        {...props}
      >
        <span className="text-xs font-medium">{name[0]}</span>
      </div>
    );
  }

  return <IconComponent className={className} {...props} />;
}

/**
 * ✅ 批量预加载图标
 */
export function preloadIcons(...names: (keyof typeof iconMap)[]) {
  names.forEach(name => {
    if (iconMap[name]) {
      // 触发动态导入
      iconMap[name];
    }
  });
}

/**
 * ✅ 常用图标组合预加载
 */
export function preloadCommonIcons() {
  preloadIcons('User', 'Settings', 'Menu', 'X', 'CreditCard', 'Wallet');
}