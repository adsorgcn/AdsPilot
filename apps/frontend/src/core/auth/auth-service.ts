import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import getSupabaseBrowserClient from '../supabase/browser-client';
import { AuthLogger, authStorage, parseAuthError, isTokenExpiringSoon } from './auth-utils';

/**
 * Google-Monetize 简化认证服务
 *
 * 核心特性：
 * 1. 基于Supabase Auth (Google OAuth only)
 * 2. 支持三层用户架构集成
 * 3. 最小化API调用，避免过度工程化
 * 4. 完整错误处理和日志记录
 */
export class Google-MonetizeAuthService {
  private supabase = getSupabaseBrowserClient();

  /**
   * 获取当前会话
   */
  async getCurrentSession(): Promise<{ session: Session | null; user: User | null }> {
    try {
      AuthLogger.debug('获取当前用户会话...');

      const { data: { session }, error } = await this.supabase.auth.getSession();

      if (error) {
        AuthLogger.error('获取会话失败', error);
        throw error;
      }

      const user = session?.user ?? null;

      AuthLogger.log('会话获取成功', {
        userId: user?.id,
        email: user?.email,
        hasSession: !!session,
      });

      return { session, user };
    } catch (error) {
      AuthLogger.error('获取会话异常', error);
      throw error;
    }
  }

  /**
   * Google OAuth 登录
   */
  async signInWithGoogle(): Promise<{ user: User; session: Session }> {
    try {
      AuthLogger.log('开始Google OAuth登录...');

      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: this.getAuthCallbackUrl(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        const parsedError = parseAuthError(error);
        AuthLogger.error('Google OAuth登录失败', parsedError);
        throw new Error(parsedError.message);
      }

      if (!data.user || !data.session) {
        AuthLogger.error('登录返回数据不完整', data);
        throw new Error('登录数据不完整');
      }

      AuthLogger.log('Google OAuth登录成功', {
        userId: data.user.id,
        email: data.user.email,
      });

      // 保存登录时间
      authStorage.set(authStorage.get('LAST_SIGN_IN') || 'last_sign_in', new Date().toISOString());

      return {
        user: data.user,
        session: data.session,
      };
    } catch (error) {
      AuthLogger.error('Google OAuth登录异常', error);
      throw error;
    }
  }

  /**
   * 登出
   */
  async signOut(): Promise<void> {
    try {
      AuthLogger.log('开始登出流程...');

      const { error } = await this.supabase.auth.signOut();

      if (error) {
        AuthLogger.error('登出失败', error);
        throw error;
      }

      // 清理本地存储
      authStorage.clear();

      AuthLogger.log('登出成功');
    } catch (error) {
      AuthLogger.error('登出异常', error);
      throw error;
    }
  }

  /**
   * 刷新会话
   */
  async refreshSession(): Promise<{ session: Session | null; user: User | null }> {
    try {
      AuthLogger.debug('刷新用户会话...');

      const { data: { session }, error } = await this.supabase.auth.refreshSession();

      if (error) {
        AuthLogger.error('会话刷新失败', error);
        throw error;
      }

      const user = session?.user ?? null;

      AuthLogger.log('会话刷新成功', {
        hasSession: !!session,
        userId: user?.id,
      });

      return { session, user };
    } catch (error) {
      AuthLogger.error('会话刷新异常', error);
      throw error;
    }
  }

  /**
   * 监听认证状态变化
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    AuthLogger.debug('注册认证状态监听器...');

    const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        AuthLogger.log(`认证状态变化: ${event}`, {
          userId: session?.user?.id,
          email: session?.user?.email,
        });

        callback(event, session);
      }
    );

    return subscription;
  }

  /**
   * 检查Token是否需要刷新
   */
  shouldRefreshToken(session: Session | null): boolean {
    if (!session || !session.access_token) {
      return false;
    }

    return isTokenExpiringSoon(session.access_token);
  }

  /**
   * 获取认证回调URL
   */
  private getAuthCallbackUrl(): string {
    if (typeof window !== 'undefined') {
      const callbackUrl = authStorage.get(authStorage.get('AUTH_CALLBACK_URL') || 'auth_callback_url');

      if (callbackUrl) {
        return `${window.location.origin}/${callbackUrl}`;
      }
    }

    return `${window.location.origin}/auth/callback`;
  }

  /**
   * 更新用户元数据 (Layer 1 数据同步)
   */
  async updateUserMetadata(metadata: Record<string, any>): Promise<User> {
    try {
      AuthLogger.log('更新用户元数据...', metadata);

      const { data: { user }, error } = await this.supabase.auth.updateUser({
        data: {
          app_metadata: metadata,
        },
      });

      if (error) {
        AuthLogger.error('更新用户元数据失败', error);
        throw error;
      }

      if (!user) {
        throw new Error('更新后用户数据为空');
      }

      AuthLogger.log('用户元数据更新成功', metadata);
      return user;
    } catch (error) {
      AuthLogger.error('更新用户元数据异常', error);
      throw error;
    }
  }

  /**
   * 重置密码
   */
  async resetPassword(email: string): Promise<void> {
    try {
      AuthLogger.log('发送密码重置邮件...', { email });

      const { error } = await this.supabase.auth.resetPasswordForEmail(email);

      if (error) {
        AuthLogger.error('密码重置失败', error);
        throw error;
      }

      AuthLogger.log('密码重置邮件发送成功', { email });
    } catch (error) {
      AuthLogger.error('密码重置异常', error);
      throw error;
    }
  }

  /**
   * 静默创建初始化服务实例
   */
  static getInstance(): Google-MonetizeAuthService {
    return new Google-MonetizeAuthService();
  }
}

// 导出单例实例
export const authService = Google-MonetizeAuthService.getInstance();
