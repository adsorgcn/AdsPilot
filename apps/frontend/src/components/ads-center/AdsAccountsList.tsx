'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import type { AdsAccount } from '~/lib/ads-center/types';
import {
  RefreshCw,
  Trash2,
  Settings,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

interface AdsAccountsListProps {
  accounts: AdsAccount[];
  isLoading?: boolean;
  onRefresh?: (accountId: string) => void;
  onDelete?: (accountId: string) => void;
  onConfigure?: (accountId: string) => void;
  className?: string;
}

/**
 * List and management of connected ads accounts
 * Design reference: design.md lines 2083-2114 (Ads Account Management)
 */
export function AdsAccountsList({
  accounts,
  isLoading = false,
  onRefresh,
  onDelete,
  onConfigure,
  className = '',
}: AdsAccountsListProps) {
  const { t } = useTranslation();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'google':
        return <span className="text-blue-600 font-bold text-lg">G</span>;
      case 'facebook':
        return <span className="text-blue-700 font-bold text-lg">f</span>;
      case 'tiktok':
        return <span className="text-black font-bold text-lg">TT</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: AdsAccount['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('adsCenter.status.active', 'Active')}
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="secondary" className="gap-1">
            <Minus className="h-3 w-3" />
            {t('adsCenter.status.paused', 'Paused')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="gap-1">
            <AlertTriangle className="h-3 w-3 text-yellow-600" />
            {t('adsCenter.status.pending', 'Pending')}
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {t('adsCenter.status.error', 'Error')}
          </Badge>
        );
      case 'suspended':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {t('adsCenter.status.suspended', 'Suspended')}
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="secondary" className="gap-1">
            <Minus className="h-3 w-3" />
            {t('adsCenter.status.disconnected', 'Disconnected')}
          </Badge>
        );
      case 'unknown':
        return (
          <Badge variant="outline" className="gap-1">
            <Minus className="h-3 w-3" />
            {t('adsCenter.status.unknown', 'Unknown')}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    if (!trend) return null;

    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-600" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const handleRefresh = async (accountId: string) => {
    setProcessingIds((prev) => new Set(prev).add(accountId));
    try {
      await onRefresh?.(accountId);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm(t('adsCenter.confirmDelete', 'Are you sure you want to disconnect this account?'))) {
      return;
    }

    setProcessingIds((prev) => new Set(prev).add(accountId));
    try {
      await onDelete?.(accountId);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            {t('adsCenter.loadingAccounts', 'Loading accounts...')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <div className="text-muted-foreground">
            <p className="text-sm mb-2">
              {t('adsCenter.noAccounts', 'No connected accounts')}
            </p>
            <p className="text-xs">
              {t('adsCenter.connectFirstAccount', 'Connect your first advertising account to get started')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {accounts.map((account) => {
        const isProcessing = processingIds.has(account.id);

        return (
          <Card key={account.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    {getPlatformIcon(account.platform || 'other')}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{account.accountName}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {account.platform || 'Unknown'}
                      </Badge>
                      {getStatusBadge(account.status)}
                      {account.lastSyncAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t('adsCenter.lastSync', 'Synced')}{' '}
                          {new Date(account.lastSyncAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRefresh(account.id)}
                    disabled={isProcessing}
                    className="gap-1"
                  >
                    <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    {t('common.refresh', 'Refresh')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onConfigure?.(account.id)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(account.id)}
                    disabled={isProcessing}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Account Stats */}
            {account.stats && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Total Spend */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t('adsCenter.stats.totalSpend', 'Total Spend')}
                    </p>
                    <div className="flex items-center gap-1">
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(account.stats.totalSpend, account.currency ?? account.currencyCode ?? 'USD')}
                      </p>
                      {getTrendIcon(account.stats.spendTrend)}
                    </div>
                  </div>

                  {/* Impressions */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t('adsCenter.stats.impressions', 'Impressions')}
                    </p>
                    <p className="text-lg font-bold">
                      {formatNumber(account.stats.impressions)}
                    </p>
                  </div>

                  {/* Clicks */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t('adsCenter.stats.clicks', 'Clicks')}
                    </p>
                    <p className="text-lg font-bold">
                      {formatNumber(account.stats.clicks)}
                    </p>
                  </div>

                  {/* CTR */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t('adsCenter.stats.ctr', 'CTR')}
                    </p>
                    <p className="text-lg font-bold text-blue-600">
                      {(account.stats.ctr * 100).toFixed(2)}%
                    </p>
                  </div>

                  {/* Avg CPC */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t('adsCenter.stats.avgCPC', 'Avg CPC')}
                    </p>
                    <p className="text-lg font-bold text-purple-600">
                      {formatCurrency(account.stats.avgCPC, account.currency ?? account.currencyCode ?? 'USD')}
                    </p>
                  </div>

                  {/* ROAS */}
                  {account.stats.roas !== undefined && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {t('adsCenter.stats.roas', 'ROAS')}
                      </p>
                      <p className="text-lg font-bold text-green-600">
                        {account.stats.roas.toFixed(2)}x
                      </p>
                    </div>
                  )}
                </div>

                {/* Error message */}
                {account.error && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{account.error}</span>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
