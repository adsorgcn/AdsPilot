import { User } from '@supabase/supabase-js';

/**
 * Google-Monetize 认证工具函数
 *
 * 遵循设计原则：
 * 1. 基于Supabase Auth (Google OAuth only)
 * 2. 支持三层用户架构
 * 3. 最小化实现，避免过度工程化
 */

/**
 * 检查用户是否为管理员 (Layer 1 数据)
 */
export function isAdminUser(user: User | null): boolean {
  return user?.app_metadata?.role === 'SuperAdmin';
}

/**
 * 获取用户角色
 */
export function getUserRole(user: User | null): 'admin' | 'user' | null {
  if (!user) return null;

  return isAdminUser(user) ? 'admin' : 'user';
}

/**
 * 获取用户显示名称
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) return 'Unknown User';

  return user.user_metadata?.name ||
         user.user_metadata?.full_name ||
         user.email?.split('@')[0] ||
         'Unknown User';
}

/**
 * 获取用户头像URL
 */
export function getUserAvatarUrl(user: User | null): string | null {
  if (!user) return null;

  return user.user_metadata?.avatar_url ||
         user.user_metadata?.picture ||
         null;
}

/**
 * 检查用户是否完成了邮箱验证
 */
export function isEmailVerified(user: User | null): boolean {
  return Boolean(user?.email_confirmed_at);
}

/**
 * 获取用户创建时间
 */
export function getUserCreatedAt(user: User | null): Date | null {
  if (!user) return null;

  return new Date(user.created_at);
}

/**
 * 检查用户是否为新注册 (7天内)
 */
export function isNewUser(user: User | null): boolean {
  if (!user) return false;

  const createdAt = getUserCreatedAt(user);
  if (!createdAt) return false;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return createdAt > sevenDaysAgo;
}

/**
 * 生成用户初始资料对象
 * 用于Layer 2/3数据初始化
 */
export function createInitialUserProfile(user: User) {
  return {
    user_id: user.id,
    email: user.email || '',
    full_name: getUserDisplayName(user),
    avatar_url: getUserAvatarUrl(user),
    role: getUserRole(user),
    email_verified: isEmailVerified(user),
    created_at: user.created_at,
    updated_at: new Date().toISOString(),
  };
}

/**
 * JWT Token 解析工具
 */
export function parseJWTToken(token: string): any {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch (error) {
    console.error('JWT Token 解析失败:', error);
    return null;
  }
}

/**
 * 检查Token是否即将过期 (15分钟内)
 */
export function isTokenExpiringSoon(token: string): boolean {
  const parsed = parseJWTToken(token);
  if (!parsed || !parsed.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  const fifteenMinutes = 15 * 60;

  return (parsed.exp - now) < fifteenMinutes;
}

/**
 * 认证错误类型枚举
 */
export enum AuthErrorType {
  NO_SESSION = 'NO_SESSION',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

/**
 * 解析认证错误
 */
export function parseAuthError(error: any): { type: AuthErrorType; message: string } {
  const message = error?.message || '未知认证错误';

  if (message.includes('Invalid login')) {
    return { type: AuthErrorType.INVALID_CREDENTIALS, message: '用户名或密码错误' };
  }

  if (message.includes('token')) {
    return { type: AuthErrorType.TOKEN_EXPIRED, message: '登录已过期，请重新登录' };
  }

  if (message.includes('permission')) {
    return { type: AuthErrorType.PERMISSION_DENIED, message: '权限不足' };
  }

  if (message.includes('network') || message.includes('fetch')) {
    return { type: AuthErrorType.NETWORK_ERROR, message: '网络连接错误' };
  }

  return { type: AuthErrorType.NETWORK_ERROR, message };
}

/**
 * 认证状态日志工具
 */
export class AuthLogger {
  private static context = 'Google-Monetize-Auth';

  static log(message: string, data?: any) {
    console.log(`✅ [${this.context}] ${message}`, data || '');
  }

  static error(message: string, error?: any) {
    console.error(`❌ [${this.context}] ${message}`, error || '');
  }

  static warn(message: string, data?: any) {
    console.warn(`⚠️ [${this.context}] ${message}`, data || '');
  }

  static debug(message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 [${this.context}] ${message}`, data || '');
    }
  }
}

/**
 * 本地存储键名常量
 */
export const STORAGE_KEYS = {
  AUTH_CALLBACK_URL: 'auth_callback_url',
  USER_PREFERENCES: 'user_preferences',
  LAST_SIGN_IN: 'last_sign_in_time',
} as const;

/**
 * 本地存储工具
 */
export const authStorage = {
  set: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },

  get: (key: string): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },

  remove: (key: string) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  },

  clear: () => {
    if (typeof window !== 'undefined') {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    }
  },
};
