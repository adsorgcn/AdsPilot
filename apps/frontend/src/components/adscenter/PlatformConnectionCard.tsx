'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ExternalLink,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '~/components/ui/GlassCard';
import { GradientButton } from '~/components/ui/GradientButton';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { cn } from '~/core/generic/shadcn-utils';

export type PlatformType = 'google' | 'meta' | 'tiktok' | 'twitter' | 'linkedin';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface PlatformConnectionCardProps {
  /**
   * Platform identifier
   */
  platform: PlatformType;
  /**
   * Connection status
   */
  status: ConnectionStatus;
  /**
   * Platform account name (if connected)
   */
  accountName?: string;
  /**
   * Platform account ID (if connected)
   */
  accountId?: string;
  /**
   * Last sync timestamp
   */
  lastSync?: Date;
  /**
   * Error message (if status is error)
   */
  errorMessage?: string;
  /**
   * Callback when connect button is clicked
   */
  onConnect?: () => void;
  /**
   * Callback when disconnect button is clicked
   */
  onDisconnect?: () => void;
  /**
   * Callback when sync button is clicked
   */
  onSync?: () => void;
  /**
   * Callback when settings button is clicked
   */
  onSettings?: () => void;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const platformConfig: Record<PlatformType, {
  name: string;
  color: string;
  bgColor: string;
  logo: string;
  description: string;
}> = {
  google: {
    name: 'Google Ads',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500',
    logo: '🔵', // In production, use actual logo image
    description: 'Connect your Google Ads account',
  },
  meta: {
    name: 'Meta Ads',
    color: 'text-blue-500',
    bgColor: 'bg-blue-600',
    logo: '📘', // In production, use actual logo image
    description: 'Connect Facebook & Instagram Ads',
  },
  tiktok: {
    name: 'TikTok Ads',
    color: 'text-pink-600',
    bgColor: 'bg-pink-500',
    logo: '🎵', // In production, use actual logo image
    description: 'Connect your TikTok Ads account',
  },
  twitter: {
    name: 'Twitter Ads',
    color: 'text-sky-500',
    bgColor: 'bg-sky-500',
    logo: '🐦', // In production, use actual logo image
    description: 'Connect your Twitter Ads account',
  },
  linkedin: {
    name: 'LinkedIn Ads',
    color: 'text-blue-700',
    bgColor: 'bg-blue-700',
    logo: '💼', // In production, use actual logo image
    description: 'Connect your LinkedIn Ads account',
  },
};

/**
 * PlatformConnectionCard - Card for managing ad platform connections
 * 
 * Displays connection status, account info, and provides actions
 * for connecting, disconnecting, and syncing ad accounts.
 */
export function PlatformConnectionCard({
  platform,
  status,
  accountName,
  accountId,
  lastSync,
  errorMessage,
  onConnect,
  onDisconnect,
  onSync,
  onSettings,
  className,
}: PlatformConnectionCardProps) {
  const { t } = useTranslation('common');
  const config = platformConfig[platform];

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            <CheckCircle2 className="h-3 w-3" />
            {t('adscenter.status.connected', 'Connected')}
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('adscenter.status.connecting', 'Connecting...')}
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {t('adscenter.status.error', 'Error')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {t('adscenter.status.disconnected', 'Not Connected')}
          </Badge>
        );
    }
  };

  const formatLastSync = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return t('adscenter.sync.justNow', 'Just now');
    if (diffMins < 60) return t('adscenter.sync.minutesAgo', '{{count}} min ago', { count: diffMins });
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('adscenter.sync.hoursAgo', '{{count}} hr ago', { count: diffHours });
    
    const diffDays = Math.floor(diffHours / 24);
    return t('adscenter.sync.daysAgo', '{{count}} day ago', { count: diffDays });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <GlassCard 
        variant="default"
        className={cn(
          'group relative overflow-hidden transition-all duration-300',
          'hover:shadow-lg hover:scale-[1.02]',
          status === 'connected' && 'ring-2 ring-green-500/20',
          status === 'error' && 'ring-2 ring-red-500/20'
        )}
      >
        {/* Glow effect on hover */}
        <div className={cn(
          'absolute inset-0 opacity-0 transition-opacity duration-300',
          'bg-gradient-to-br from-transparent via-transparent to-transparent',
          'group-hover:opacity-100',
          status === 'connected' && 'group-hover:from-green-500/5 group-hover:to-emerald-500/5',
          status === 'disconnected' && 'group-hover:from-blue-500/5 group-hover:to-purple-500/5',
          status === 'error' && 'group-hover:from-red-500/5 group-hover:to-orange-500/5'
        )} />

        <GlassCardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Platform logo */}
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl text-2xl',
                'shadow-lg transition-transform duration-300 group-hover:scale-110',
                config.bgColor
              )}>
                {config.logo}
              </div>
              <div>
                <GlassCardTitle className="text-lg">
                  {config.name}
                </GlassCardTitle>
                <p className="text-xs text-muted-foreground">
                  {config.description}
                </p>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </GlassCardHeader>

        <GlassCardContent className="space-y-4">
          {/* Connected account info */}
          {status === 'connected' && accountName && (
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{accountName}</p>
                  {accountId && (
                    <p className="text-xs text-muted-foreground">
                      ID: {accountId}
                    </p>
                  )}
                </div>
                {lastSync && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {t('adscenter.lastSync', 'Last sync')}
                    </p>
                    <p className="text-xs font-medium">
                      {formatLastSync(lastSync)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error message */}
          {status === 'error' && errorMessage && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-300">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {status === 'connected' ? (
              <>
                {onSync && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSync}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t('adscenter.actions.sync', 'Sync')}
                  </Button>
                )}
                {onSettings && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSettings}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
                {onDisconnect && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onDisconnect}
                  >
                    {t('adscenter.actions.disconnect', 'Disconnect')}
                  </Button>
                )}
              </>
            ) : (
              <GradientButton
                variant="primary"
                size="sm"
                onClick={onConnect}
                disabled={status === 'connecting'}
                className="flex-1 group/btn"
              >
                {status === 'connecting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('adscenter.actions.connecting', 'Connecting...')}
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                    {t('adscenter.actions.connect', 'Connect')}
                  </>
                )}
              </GradientButton>
            )}
          </div>
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}