'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import { Button } from '~/core/ui/Button';
import { Badge } from '~/core/ui/Badge';
import { Loader2, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';

export type AdsPlatform = 'google' | 'facebook' | 'tiktok';

interface SimpleOAuthFlowProps {
  platform: AdsPlatform;
  onError?: (error: Error) => void;
  className?: string;
}

interface PlatformConfig {
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  scopes: string[];
}

const PLATFORM_CONFIGS: Record<AdsPlatform, PlatformConfig> = {
  google: {
    name: 'Google Ads',
    icon: <span className="text-2xl font-bold">G</span>,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    scopes: ['https://www.googleapis.com/auth/adwords'],
  },
  facebook: {
    name: 'Facebook Ads',
    icon: <span className="text-2xl font-bold">f</span>,
    color: 'text-blue-700',
    bgColor: 'bg-blue-600',
    scopes: ['ads_management', 'ads_read'],
  },
  tiktok: {
    name: 'TikTok Ads',
    icon: <span className="text-2xl font-bold">TT</span>,
    color: 'text-black',
    bgColor: 'bg-black',
    scopes: ['user.info.basic', 'advertiser.read'],
  },
};

/**
 * 简化的OAuth授权流程组件
 *
 * OAuth流程：
 * 1. 用户点击连接��钮
 * 2. 前端请求后端OAuth URL: GET /api/v1/adscenter/oauth/url
 * 3. 后端生成Google OAuth URL并返回
 * 4. 前端重定向到Google OAuth页面
 * 5. 用户授权后，Google重定向到后端回调: /api/v1/adscenter/oauth/callback
 * 6. 后端处理回调，存储tokens，重定向回前端页面
 */
export function SimpleOAuthFlow({
  platform,
  onError,
  className = '',
}: SimpleOAuthFlowProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = PLATFORM_CONFIGS[platform];

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 请求后端OAuth URL
      const response = await fetch('/api/v1/users/auth/oauth/url', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(t('adsCenter.oauth.failedToGetAuthUrl', 'Failed to get authorization URL'));
      }

      const { authUrl } = await response.json();

      // 直接重定向到OAuth URL
      window.location.href = authUrl;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(false);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className={`w-12 h-12 ${config.bgColor} rounded-lg flex items-center justify-center ${config.color}`}>
            {config.icon}
          </div>
          <div className="flex-1">
            <div className="font-semibold">{config.name}</div>
            <div className="text-sm font-normal text-muted-foreground">
              {t('adsCenter.oauth.connectYourAccount', 'Connect your account')}
            </div>
          </div>
          {isLoading && (
            <Badge className="bg-yellow-100 text-yellow-800">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('adsCenter.oauth.connecting', 'Connecting')}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" onClick={handleRetry} className="w-full gap-2">
              <ExternalLink className="h-4 w-4" />
              {t('adsCenter.oauth.tryAgain', 'Try Again')}
            </Button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{t('adsCenter.oauth.secureOAuth', 'Secure OAuth 2.0 authentication')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="h-4 w-4 text-blue-600">🔐</span>
                <span>{t('adsCenter.oauth.readOnlyAccess', 'Read-only access to your ads data')}</span>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                {t('adsCenter.oauth.requiredPermissions', 'Required permissions')}:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {config.scopes.map((scope, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                    {scope}
                  </li>
                ))}
              </ul>
            </div>

            <Button onClick={handleConnect} className="w-full gap-2">
              <ExternalLink className="h-4 w-4" />
              {t('adsCenter.oauth.authorizeAccount', `Authorize ${config.name}`)}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}