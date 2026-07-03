'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import getSupabaseBrowserClient from '../supabase/browser-client';

// 符合Google-Monetize架构的简化认证类型
interface Google-MonetizeAuthContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  // 用户角色：基于Supabase app_metadata.role
  isAdmin: boolean;
  userId: string | null;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<Google-MonetizeAuthContext | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Google-Monetize 简化认证提供者
 *
 * 设计原则：
 * 1. 严格遵循 Supabase Auth (Google OAuth only)
 * 2. 支持三层用户架构 (Layer 1: auth.users)
 * 3. 最小化实现，避免过度工程化
 * 4. 符合用户直连模式，无组织层概念
 *
 * 认证数据流：
 * - Layer 1: Supabase auth.users (权威认证数据源)
 * - Layer 2: Cloud SQL user.users (业务用户数据)
 * - Layer 3: Cloud SQL billing.accounts (计费数据)
 */
export function Google-MonetizeAuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    let mounted = true;

    // 初始化认证状态
    async function initializeAuth() {
      try {
        console.log('🔐 初始化Google-Monetize认证系统...');

        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            console.log(`✅ 用户已认证: ${session.user.email}`, session.user);
          }

          setLoading(false);
        }
      } catch (error) {
        console.error('❌ 认证初始化失败:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    }

    initializeAuth();

    // 监听Supabase认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log(`🔄 认证状态变化: ${event}`, session?.user?.email);

      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // 根据事件类型处理特定逻辑
        switch (event) {
          case 'SIGNED_IN':
            console.log('✅ 用户登录成功');
            break;
          case 'SIGNED_OUT':
            console.log('👋 用户已登出');
            break;
          case 'TOKEN_REFRESHED':
            console.log('🔄 Token刷新成功');
            break;
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    try {
      console.log('👋 开始登出流程...');
      await supabase.auth.signOut();
      // onAuthStateChange 会自动清理状态
      console.log('✅ 登出成功');
    } catch (error) {
      console.error('❌ 登出失败:', error);
      throw error;
    }
  };

  const refresh = async () => {
    try {
      console.log('🔄 刷新用户会话...');
      const { data: { session } } = await supabase.auth.refreshSession();
      setSession(session);
      setUser(session?.user ?? null);
      console.log('✅ 会话刷新成功');
    } catch (error) {
      console.error('❌ 会话刷新失败:', error);
      setSession(null);
      setUser(null);
    }
  };

  // 从 app_metadata 获取用户角色 (Layer 1 数据)
  const isAdmin = user?.app_metadata?.role === 'SuperAdmin';
  const userId = user?.id ?? null;

  const value: Google-MonetizeAuthContext = {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    userId,
    signOut,
    refresh,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 使用Google-Monetize认证上下文的Hook
 */
export function useGoogle-MonetizeAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useGoogle-MonetizeAuth must be used within Google-MonetizeAuthProvider');
  }
  return context;
}

/**
 * 简化的认证状态检查Hook
 */
export function useAuthStatus() {
  const { user, loading, isAdmin } = useGoogle-MonetizeAuth();

  return {
    isAuthenticated: !!user,
    isLoading: loading,
    needsAuth: !user && !loading,
    isAdmin,
    user,
    userId: user?.id ?? null,
    email: user?.email ?? null,
  };
}

/**
 * Google OAuth 登录Hook
 */
export function useGoogleSignIn() {
  const supabase = getSupabaseBrowserClient();

  return async () => {
    try {
      console.log('🔗 开始Google OAuth登录...');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('❌ Google OAuth登录失败:', error);
        throw error;
      }

      console.log('✅ Google OAuth登录成功');
      return data;
    } catch (error) {
      console.error('❌ Google OAuth登录异常:', error);
      throw error;
    }
  };
}

/**
 * 获取用户显示名称
 */
export function useUserDisplayName() {
  const { user } = useGoogle-MonetizeAuth();

  if (!user) {
    return null;
  }

  // 优先使用 user.name，然后是 email
  const displayName = user.user_metadata?.name ||
                   user.user_metadata?.full_name ||
                   user.email?.split('@')[0] ||
                   'Unknown User';

  return displayName;
}
