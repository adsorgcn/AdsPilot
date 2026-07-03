/**
 * 管理后台导航配置
 *
 * 集中管理所有管理后台页面的导航链接
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChartBarIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  BellIcon,
  ClockIcon,
  FlagIcon,
  DocumentTextIcon,
  CubeIcon,
  SparklesIcon,
  UserGroupIcon,
  BoltIcon,
  CurrencyDollarIcon,
  RectangleStackIcon,
  MegaphoneIcon,
  CogIcon,
} from '@heroicons/react/24/outline';

export interface AdminNavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    name: '总览',
    href: '/manage',
    icon: ChartBarIcon,
    description: '系统总览与关键指标',
  },
  {
    name: '性能监控',
    href: '/manage/performance',
    icon: BoltIcon,
    description: 'Web Vitals性能指标',
  },
  {
    name: '系统监控',
    href: '/manage/monitoring',
    icon: ClockIcon,
    description: '服务健康与系统指标',
  },
  {
    name: '财务分析',
    href: '/manage/financial',
    icon: CreditCardIcon,
    description: '收入成本与利润分析',
  },
  {
    name: '数据分析',
    href: '/manage/analytics',
    icon: ChartBarIcon,
    description: '用户增长与业务指标',
  },
  {
    name: 'Offer管理',
    href: '/manage/offers',
    icon: CubeIcon,
    description: 'Offer质量与统计',
  },
  {
    name: '任务管理',
    href: '/manage/tasks',
    icon: SparklesIcon,
    description: '任务状态与执行统计',
  },
  {
    name: '用户管理',
    href: '/manage/users',
    icon: UserGroupIcon,
    description: '用户列表与权限管理',
  },
  {
    name: '订阅管理',
    href: '/manage/subscriptions',
    icon: RectangleStackIcon,
    description: '订阅状态与套餐管理',
  },
  {
    name: '订阅配置',
    href: '/manage/subscription-config',
    icon: CogIcon,
    description: '套餐权限与价格配置',
  },
  {
    name: 'Token管理',
    href: '/manage/tokens',
    icon: CurrencyDollarIcon,
    description: 'Token余额与消费统计',
  },
  {
    name: 'Ads账号管理',
    href: '/manage/ads-accounts',
    icon: MegaphoneIcon,
    description: '广告账号与批量操作',
  },
  {
    name: '安全审计',
    href: '/manage/security',
    icon: ShieldCheckIcon,
    description: '安全事件与审计日志',
  },
  {
    name: '通知中心',
    href: '/manage/notifications',
    icon: BellIcon,
    description: '系统通知与告警',
  },
  {
    name: '功能开关',
    href: '/manage/feature-flags',
    icon: FlagIcon,
    description: 'Feature Flag管理',
  },
  {
    name: '导出记录',
    href: '/manage/exports',
    icon: DocumentTextIcon,
    description: '数据导出历史',
  },
];

/**
 * 管理后台侧边导航
 */
export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {ADMIN_NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
              ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <div className="flex-1">
              <div className="font-medium">{item.name}</div>
              <div
                className={`text-xs ${isActive ? 'text-primary/70' : 'text-muted-foreground'}`}
              >
                {item.description}
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
