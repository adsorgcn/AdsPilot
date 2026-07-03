/**
 * Mobile Bottom Navigation Types
 * 移动端底部导航类型定义
 */

import type { ComponentType } from 'react';

export type MobileItem = {
  key: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  label?: string;
  labelKey?: string;
  match?: (pathname: string, href: string) => boolean;
};
