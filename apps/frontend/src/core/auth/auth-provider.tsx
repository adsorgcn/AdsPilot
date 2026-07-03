'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import getSupabaseBrowserClient from '../supabase/browser-client';

// Simplified auth context type
interface SimpleAuthContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<SimpleAuthContext | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Simplified auth provider - avoiding over-engineering principles
 * Minimal implementation based on Supabase Auth
 */
export function SimpleAuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    let mounted = true;

    // Get initial session state
    async function initializeAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    }

    initializeAuth();

    // Listen for auth state changes - single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log('Auth state changed:', event, session?.user?.email);

      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      // onAuthStateChange will automatically handle state cleanup
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  };

  const refresh = async () => {
    try {
      const { data: { session } } = await supabase.auth.refreshSession();
      setSession(session);
      setUser(session?.user ?? null);
    } catch (error) {
      console.error('Session refresh failed:', error);
      setSession(null);
      setUser(null);
    }
  };

  const value: SimpleAuthContext = {
    user,
    session,
    loading,
    isAuthenticated: !!user,
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
 * 使用认证上下文的Hook
 */
export function useSimpleAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSimpleAuth must be used within SimpleAuthProvider');
  }
  return context;
}

/**
 * 便捷的认证状态检查Hook
 */
export function useAuthCheck() {
  const { user, loading } = useSimpleAuth();

  return {
    isAuthenticated: !!user,
    isLoading: loading,
    needsAuth: !user && !loading,
    user,
  };
}

/**
 * 获取当前用户ID的Hook
 */
export function useUserId() {
  const { user } = useSimpleAuth();
  return user?.id ?? null;
}

/**
 * 检查用户是否有特定邮箱域名
 * 用于管理员权限检查等场景
 */
export function useUserEmailDomain() {
  const { user } = useSimpleAuth();
  const email = user?.email ?? '';

  return {
    domain: email.split('@')[1] ?? '',
    isAdminDomain: email.endsWith('@gm.ai') || email.endsWith('@admin.gm.ai'),
  };
}
