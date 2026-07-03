/**
 * Mobile Bottom Navigation Utils
 * 移动端底部导航工具函数
 */

import { createElement } from 'react';
import type { ComponentType, ElementType } from 'react';
import configuration from '~/configuration';

export function ensureAbsolutePath(path: string): string {
  if (!path) {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
}

export function getPath(path: string): string {
  const prefix = configuration.paths.appPrefix;

  return [prefix, path].filter(Boolean).join('/');
}

export function adaptIconRenderer(
  icon: ComponentType<{ className: string }>,
): ComponentType<{ className?: string }> {
  const Wrapped: ComponentType<{ className?: string }> = ({ className = '' }) =>
    createElement(icon, { className });

  return Wrapped;
}

export function adaptNavigationIcon(
  icon?: ElementType,
): ComponentType<{ className?: string }> {
  if (!icon) {
    return () => null;
  }

  const Wrapped: ComponentType<{ className?: string }> = ({ className = '' }) =>
    createElement(icon, { className });

  return Wrapped;
}
