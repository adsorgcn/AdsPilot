import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  HomeIcon
} from '@heroicons/react/24/outline';

export interface AuthErrorHandlerProps {
  errorCode: string;
  errorDetails?: string;
  onRetry?: () => void;
  onBackToLogin?: () => void;
  onGoHome?: () => void;
  showRetry?: boolean;
  className?: string;
}

/**
 * 认证错误处理组件
 * 提供用户友好的错误提示和操作按钮
 */
export default function AuthErrorHandler({
  errorCode,
  errorDetails,
  onRetry,
  onBackToLogin,
  onGoHome,
  showRetry = true,
  className = ""
}: AuthErrorHandlerProps) {
  const { t } = useTranslation();

  // 错误类型配置
  const errorConfigs: Record<string, {
    icon: React.ComponentType<any>;
    title: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    showRetry: boolean;
  }> = {
    'user_init_failed': {
      icon: ExclamationTriangleIcon,
      title: t('auth.errors.userInitFailed.title', '用户数据初始化失败'),
      message: t('auth.errors.userInitFailed.message', '系统在为您创建业务数据时遇到了问题，请重试或联系客服。'),
      severity: 'error',
      showRetry: true
    },
    'network_error': {
      icon: ExclamationCircleIcon,
      title: t('auth.errors.networkError.title', '网络连接异常'),
      message: t('auth.errors.networkError.message', '无法连接到服务器，请检查您的网络连接后重试。'),
      severity: 'warning',
      showRetry: true
    },
    'auth_timeout': {
      icon: ExclamationCircleIcon,
      title: t('auth.errors.authTimeout.title', '认证超时'),
      message: t('auth.errors.authTimeout.message', '认证过程超时，请重新登录。'),
      severity: 'warning',
      showRetry: true
    },
    'session_expired': {
      icon: ExclamationCircleIcon,
      title: t('auth.errors.sessionExpired.title', '会话已过期'),
      message: t('auth.errors.sessionExpired.message', '您的登录会话已过期，请重新登录。'),
      severity: 'warning',
      showRetry: false
    },
    'invalid_credentials': {
      icon: ExclamationTriangleIcon,
      title: t('auth.errors.invalidCredentials.title', '认证信息无效'),
      message: t('auth.errors.invalidCredentials.message', '认证信息无效或已过期，请重新登录。'),
      severity: 'error',
      showRetry: false
    },
    'account_disabled': {
      icon: ExclamationTriangleIcon,
      title: t('auth.errors.accountDisabled.title', '账户已禁用'),
      message: t('auth.errors.accountDisabled.message', '您的账户已被禁用，请联系客服。'),
      severity: 'error',
      showRetry: false
    },
    'email_not_confirmed': {
      icon: ExclamationCircleIcon,
      title: t('auth.errors.emailNotConfirmed.title', '邮箱未验证'),
      message: t('auth.errors.emailNotConfirmed.message', '请先验证您的邮箱地址。'),
      severity: 'warning',
      showRetry: false
    },
    'unknown_error': {
      icon: ExclamationTriangleIcon,
      title: t('auth.errors.unknown.title', '未知错误'),
      message: t('auth.errors.unknown.message', '发生了未知错误，请重试或联系客服。'),
      severity: 'error',
      showRetry: true
    }
  };

  // 获取当前错误配置，默认为未知错误
  const config = errorConfigs[errorCode] || errorConfigs['unknown_error'];

  // 根据严重程度设置图标颜色
  const getIconColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const Icon = config.icon;
  const iconColor = getIconColor(config.severity);

  // 处理重试操作
  const handleRetry = () => {
    console.log(`🔄 重试解决错误: ${errorCode}`);
    onRetry?.();
  };

  // 处理返回登录
  const handleBackToLogin = () => {
    console.log(`🔙 返回登录页面，错误: ${errorCode}`);
    onBackToLogin?.();
  };

  // 处理返回首页
  const handleGoHome = () => {
    console.log(`🏠 返回首页，错误: ${errorCode}`);
    onGoHome?.();
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen px-4 ${className}`}>
      <div className="max-w-md w-full">
        {/* 错误图标 */}
        <div className="text-center mb-6">
          <Icon className={`h-16 w-16 mx-auto ${iconColor}`} />
        </div>

        {/* 错误标题 */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {config.title}
          </h1>

          {/* 错误消息 */}
          <p className="text-gray-600 text-lg leading-relaxed">
            {config.message}
          </p>

          {/* 详细错误信息（如果提供） */}
          {errorDetails && process.env.NODE_ENV === 'development' && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                {t('auth.errorDetails.show', '查看详细错误')}
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded-md text-xs text-gray-800 overflow-auto">
                {errorDetails}
              </pre>
            </details>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          {/* 重试按钮 */}
          {showRetry && config.showRetry && onRetry && (
            <button
              onClick={handleRetry}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <ArrowPathIcon className="h-5 w-5" />
              {t('auth.actions.retry', '重试')}
            </button>
          )}

          {/* 返回登录按钮 */}
          {onBackToLogin && (
            <button
              onClick={handleBackToLogin}
              className="w-full flex items-center justify-center gap-2 bg-gray-200 text-gray-800 px-6 py-3 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              {t('auth.actions.backToLogin', '返回登录')}
            </button>
          )}

          {/* 返回首页按钮 */}
          {onGoHome && (
            <button
              onClick={handleGoHome}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              <HomeIcon className="h-5 w-5" />
              {t('auth.actions.goHome', '返回首页')}
            </button>
          )}
        </div>

        {/* 帮助信息 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            {t('auth.help.needAssistance', '需要帮助？')} {' '}
            <a
              href="mailto:support@autoads.dev"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              {t('auth.help.contactSupport', '联系客服')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 错误边界组件
 * 用于捕获和处理认证过程中的异常
 */
export class AuthErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error?: Error }> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ AuthErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // 这里可以添加错误上报逻辑
    // reportError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || AuthErrorHandler;

      return (
        <FallbackComponent
          errorCode="unknown_error"
          errorDetails={this.state.error?.message}
          onRetry={() => window.location.reload()}
          onBackToLogin={() => window.location.href = '/auth/login'}
        />
      );
    }

    return this.props.children;
  }
}