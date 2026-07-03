'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Link,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  AlertTriangle,
  Settings,
  ExternalLink,
  X
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import Button from '~/core/ui/Button';
import Alert from '~/core/ui/Alert';
import Badge from '~/core/ui/Badge';
import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';

interface MCCLink {
  customerId: string;
  status: 'pending' | 'invited' | 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

interface MCCManagerProps {
  onRefresh?: () => void;
}

export function MCCManager({ onRefresh }: MCCManagerProps) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<MCCLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  const { canManageAds } = useEnhancedSubscription();

  // Fetch MCC links
  const fetchLinks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/adscenter/mcc/links', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch MCC links');
      }

      const data = await response.json();
      setLinks(data.items || []);
    } catch (error) {
      console.error('Failed to fetch MCC links:', error);
      toast.error(t('mcc.errors.fetchFailed', 'Failed to load MCC links'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  // Handle link request
  const handleLink = async () => {
    if (!newCustomerId.trim()) {
      toast.error(t('mcc.errors.customerIdRequired', 'Customer ID is required'));
      return;
    }

    setIsLinking(true);
    try {
      const response = await fetch('/api/v1/adscenter/mcc/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `mcc-link-${Date.now()}-${newCustomerId}`,
        },
        body: JSON.stringify({
          customerId: newCustomerId.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send link request');
      }

      await response.json();
      toast.success(t('mcc.success.linkRequested', 'Link request sent successfully'));
      setNewCustomerId('');
      setShowLinkDialog(false);

      // Refresh links after a short delay
      setTimeout(() => {
        fetchLinks();
        onRefresh?.();
      }, 2000);
    } catch (error) {
      console.error('Failed to send link request:', error);
      toast.error(t('mcc.errors.linkFailed', 'Failed to send link request'));
    } finally {
      setIsLinking(false);
    }
  };

  // Handle unlink
  const handleUnlink = async (customerId: string) => {
    if (!confirm(t('mcc.confirmations.unlink', 'Are you sure you want to unlink this account?'))) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/adscenter/mcc/unlink?customerId=${encodeURIComponent(customerId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to unlink account');
      }

      toast.success(t('mcc.success.unlinked', 'Account unlinked successfully'));
      fetchLinks();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to unlink account:', error);
      toast.error(t('mcc.errors.unlinkFailed', 'Failed to unlink account'));
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/v1/adscenter/mcc/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh links');
      }

      const data = await response.json();
      toast.success(t('mcc.success.refreshed', `Refreshed ${data.checked} links, updated ${data.updated}`));
      fetchLinks();
    } catch (error) {
      console.error('Failed to refresh links:', error);
      toast.error(t('mcc.errors.refreshFailed', 'Failed to refresh links'));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get status badge props
  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case 'active':
        return { variant: 'default' as const, icon: <CheckCircle2 className="h-3 w-3" />, text: 'Active' };
      case 'pending':
        return { variant: 'secondary' as const, icon: <Clock className="h-3 w-3" />, text: 'Pending' };
      case 'invited':
        return { variant: 'outline' as const, icon: <AlertCircle className="h-3 w-3" />, text: 'Invited' };
      case 'inactive':
        return { variant: 'destructive' as const, icon: <AlertTriangle className="h-3 w-3" />, text: 'Inactive' };
      default:
        return { variant: 'secondary' as const, icon: <Clock className="h-3 w-3" />, text: status };
    }
  };

  if (!canManageAds) {
    return (
      <Alert type={'info'}>
        <div className="text-sm">
          {t('mcc.upgradeRequired', 'MCC management requires a premium subscription')}
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {t('mcc.title', 'MCC Account Management')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('mcc.description', 'Manage your Google Ads MCC manager account links')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLinkDialog(true)}
            disabled={!canManageAds}
          >
            <Link className="h-4 w-4" />
            {t('mcc.actions.linkAccount', 'Link Account')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('mcc.actions.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert type={'info'}>
        <div className="text-sm">
          <strong>{t('mcc.info.title', 'About MCC Links')}</strong>
          <p className="mt-1">
            {t('mcc.info.description', 'Link your Google Ads accounts to our MCC manager account to enable advanced management features. This allows us to manage campaigns, budgets, and optimizations on your behalf.')}
          </p>
        </div>
      </Alert>

      {/* Links List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('mcc.links.title', 'Linked Accounts')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="w-8 h-8 bg-muted rounded animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
                    <div className="h-3 bg-muted rounded animate-pulse w-1/4" />
                  </div>
                  <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-8">
              <ExternalLink className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {t('mcc.empty.title', 'No linked accounts')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('mcc.empty.description', 'Start by linking your first Google Ads account to our MCC manager')}
              </p>
              <Button
                onClick={() => setShowLinkDialog(true)}
                disabled={!canManageAds}
              >
                <Link className="h-4 w-4 mr-2" />
                {t('mcc.actions.linkFirst', 'Link Your First Account')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((link) => {
                const statusProps = getStatusBadgeProps(link.status);
                return (
                  <div
                    key={link.customerId}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-xs">GA</span>
                      </div>
                      <div>
                        <div className="font-medium">
                          {link.customerId}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t('mcc.linkedOn', 'Linked')} {new Date(link.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusProps.variant} className="gap-1">
                        {statusProps.icon}
                        {statusProps.text}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnlink(link.customerId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {t('mcc.dialog.title', 'Link Google Ads Account')}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLinkDialog(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="customerId" className="block text-sm font-medium mb-2">
                  {t('mcc.dialog.customerIdLabel', 'Customer ID')}
                </label>
                <input
                  id="customerId"
                  type="text"
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
                  placeholder={t('mcc.dialog.customerIdPlaceholder', 'Enter Google Ads Customer ID')}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('mcc.dialog.customerIdHelp', 'This is the 10-digit customer ID from your Google Ads account')}
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowLinkDialog(false)}
                  className="flex-1"
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  onClick={handleLink}
                  disabled={!newCustomerId.trim() || isLinking}
                  className="flex-1"
                >
                  {isLinking ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {t('mcc.dialog.linking', 'Sending...')}
                    </>
                  ) : (
                    <>
                      <Link className="h-4 w-4 mr-2" />
                      {t('mcc.dialog.link', 'Send Link Request')}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}