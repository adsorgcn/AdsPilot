'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStatus } from './simple-auth-provider';

interface AuthGuardProps {
  children: ReactNode;
  requireAdmin?: boolean; // 是否需要管理员权限
  fallback?: ReactNode;    // 未认证时的显示内容
  redirectTo?: string;     // 重定向路径
}

/**
 * Google-Monetize 认证守卫组件
 *
 * 设计原则：
 * 1. 基于Supabase Auth认证状态
 * 2. 支持管理员权限检查 (SuperAdmin role)
 * 3. 简单直观的重定向逻辑
 * 4. 符合用户直连模式，无需组织层验证
 */
export function AuthGuard({
  children,
  requireAdmin = false,
  fallback,
  redirectTo = '/auth/signin'
}: AuthGuardProps) {
  const { isAuthenticated, isLoading, isAdmin } = useAuthStatus();
  const router = useRouter();

  // 加载状态
  if (isLoading) {
    return fallback ?? <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">加载中...</p>
      </div>
    </div>;
  }

  // 未认证
  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    // 执行重定向
    if (typeof window !== 'undefined') {
      console.log('🔐 用户未认证，重定向到登录页');
      router.push(redirectTo);
    }

    return null;
  }

  // 需要管理员权限但用户不是管理员
  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">访问被拒绝</h1>
          <p className="text-gray-600">此页面需要管理员权限</p>
        </div>
      </div>
    );
  }

  // 认证通过
  return <>{children}</>;
}

/**
 * 管理员专用认证守卫
 */
export function AdminGuard({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <AuthGuard requireAdmin={true} fallback={fallback}>
      {children}
    </AuthGuard>
  );
}

/**
 * 用户认证守卫 (普通用户即可访问)
 */
export function UserGuard({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStatus();

  if (isLoading) {
    return fallback ?? <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">加载中...</p>
      </div>
    </div>;
  }

  if (!isAuthenticated) {
    return fallback ?? <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-600 mb-4">请先登录</h1>
        <p className="text-gray-600">此页面需要用户登录</p>
      </div>
    </div>;
  }

  return <>{children}</>;
}