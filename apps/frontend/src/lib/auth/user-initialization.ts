import { SupabaseClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';

export interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    picture?: string;
    provider?: string;
    new_user?: boolean;
  };
  session?: {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
  };
  created_at?: string;
  last_sign_in_at?: string;
}

export interface InitializeUserRequest {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  days?: number;
  source?: string;
}

export interface InitializeUserResponse {
  success: boolean;
  accountId?: string;
  subscriptionId?: string;
  tokenBalance?: number;
  error?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * 确保用户业务数据存在
 * 无论是否新用户，都验证业务数据的完整性
 */
export async function ensureUserBusinessData(user: User): Promise<boolean> {
  try {
    console.log('🔍 检查用户业务数据状态:', user.id);

    // 1. 查询业务用户数据是否存在
    const response = await fetch('/api/v1/user/profile', {
      headers: {
        'Authorization': `Bearer ${user.session?.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      // 业务数据已存在，检查数据完整性
      const userProfile: UserProfile = await response.json();
      console.log('✅ 用户业务数据已存在:', userProfile);

      // 验证数据完整性
      if (userProfile.status && userProfile.email) {
        console.log('✅ 用户业务数据完整性验证通过');
        return true;
      } else {
        console.warn('⚠️ 用户业务数据不完整，尝试重新初始化');
        const initResult = await initializeUserBusinessData(user);
        return initResult.success;
      }
    }

    // 2. 业务数据不存在，初始化业务数据
    if (response.status === 404) {
      console.log('🔄 用户业务数据不存在，开始初始化...');
      const initResult = await initializeUserBusinessData(user);
      return initResult.success;
    }

    // 3. 其他错误，记录日志
    const errorText = await response.text();
    console.error('❌ 检查用户业务数据失败:', response.status, errorText);
    return false;

  } catch (error) {
    console.error('❌ 用户业务数��检查异常:', error);
    return false;
  }
}

/**
 * 初始化用户业务数据
 * 创建用户记录、计费账户、试用订阅和代币余额
 */
export async function initializeUserBusinessData(user: User): Promise<InitializeUserResponse> {
  try {
    console.log('🔄 开始初始化用户业务数据...');

    // 从用户数据中提取信息
    const userName = user.user_metadata?.full_name ||
                   user.user_metadata?.name ||
                   user.email?.split('@')[0] ||
                   'Unknown User';

    const avatarUrl = user.user_metadata?.avatar_url ||
                     user.user_metadata?.picture ||
                     '';

    const request: InitializeUserRequest = {
      userId: user.id!,
      email: user.email!,
      name: userName,
      avatarUrl: avatarUrl,
      days: 7,
      source: user.user_metadata?.provider === 'google' ? 'google_oauth' : 'self_register'
    };

    console.log('📤 发送初始化请求:', request);

    const response = await fetch('/api/v1/billing/subscriptions/trial', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (response.ok) {
      const result: InitializeUserResponse = await response.json();
      console.log('✅ 用户业务数据初始化成功:', result);
      return result;
    } else {
      const errorText = await response.text();
      console.error('❌ 用户业务数据初始化失败:', response.status, errorText);
      return {
        success: false,
        error: `${response.status}: ${errorText}`
      };
    }
  } catch (error) {
    console.error('❌ 用户业务数据初始化异常:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 验证用户Session状态
 */
export async function validateUserSession(supabase: SupabaseClient): Promise<User | null> {
  try {
    console.log('🔍 验证用户Session状态...');

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('❌ 获取用户Session失败:', error);
      return null;
    }

    if (!user) {
      console.warn('⚠️ 用户未登录');
      return null;
    }

    // 检查Session是否过期
    if (user.session?.expires_at && user.session.expires_at * 1000 < Date.now()) {
      console.warn('⚠️ 用户Session已过期');
      return null;
    }

    console.log('✅ 用户Session有效:', user.id);
    return user as User;
  } catch (error) {
    console.error('❌ 验证用户Session异常:', error);
    return null;
  }
}

/**
 * 刷新用户Session
 */
export async function refreshUserSession(supabase: SupabaseClient): Promise<User | null> {
  try {
    console.log('🔄 刷新用户Session...');

    const { data: { session }, error } = await supabase.auth.refreshSession();

    if (error) {
      console.error('❌ 刷新Session失败:', error);
      return null;
    }

    if (!session?.user) {
      console.warn('⚠️ 刷新Session后用户信息为空');
      return null;
    }

    console.log('✅ 用户Session刷新成功:', session.user.id);
    return session.user as User;
  } catch (error) {
    console.error('❌ 刷新用户Session异常:', error);
    return null;
  }
}

/**
 * 用户登出
 */
export async function signOutUser(supabase: SupabaseClient): Promise<void> {
  try {
    console.log('🚪 用户登出...');

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('❌ 用户登出失败:', error);
      throw error;
    }

    console.log('✅ 用户登出成功');
  } catch (error) {
    console.error('❌ 用户登出异常:', error);
    throw error;
  }
}

/**
 * 获取Google OAuth登录URL
 */
export function getGoogleOAuthURL(supabase: SupabaseClient, redirectTo?: string): string {
  const redirectURL = redirectTo || `${window.location.origin}/auth/callback`;

  return supabase.auth.api.getUrlForProvider('google', {
    redirectTo: redirectURL,
    options: {
      scopes: 'email profile'
    }
  });
}

/**
 * 处理认证回调
 */
export async function handleAuthCallback(supabase: SupabaseClient): Promise<User | null> {
  try {
    console.log('🔄 处理认证回调...');

    // 检查URL中的认证参数
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ 获取Session失败:', error);
      return null;
    }

    if (!data.session?.user) {
      console.warn('⚠️ 认证回调中没有用户信息');
      return null;
    }

    console.log('✅ 认证回调处理成功:', data.session.user.id);
    return data.session.user as User;
  } catch (error) {
    console.error('❌ 处理认证回调异常:', error);
    return null;
  }
}

/**
 * 错误类型映射
 */
export function mapAuthErrorCode(error: string): string {
  const errorMap: Record<string, string> = {
    'user_init_failed': 'user_init_failed',
    'network_error': 'network_error',
    'auth_timeout': 'auth_timeout',
    'session_expired': 'session_expired',
    'invalid_credentials': 'invalid_credentials',
    'account_disabled': 'account_disabled',
    'email_not_confirmed': 'email_not_confirmed'
  };

  // 尝试匹配已知错误类型
  for (const [key, value] of Object.entries(errorMap)) {
    if (error.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // 默认返回未知错误
  return 'unknown_error';
}

/**
 * 检查用户是否为新用户
 * 基于创建时间和最后登录时间判断
 */
export function isNewUser(user: User): boolean {
  if (!user.created_at) return true;

  const createdAt = new Date(user.created_at);
  const now = new Date();
  const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  // 创建时间小于1小时认为是新用户
  return hoursSinceCreation < 1;
}