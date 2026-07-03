'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '~/core/ui/Alert';
import { Button } from '~/core/ui/Button';
import { X, AlertTriangle, RefreshCw, CreditCard, Calendar } from 'lucide-react';

interface DashboardStats {
  userId: string;
  totalOffers: number;
  evaluatedOffers: number;
  pendingEvaluations: number;
  aiEvaluationsTotal: number;
  aiEvaluationsSuccess: number;
  aiEvaluationsFailed: number;
  tokensTotal: number;
  tokensConsumed: number;
  tokensRemaining: number;
  recentEvaluations: Array<{
    id: string;
    offerId: string;
    type: string;
    status: string;
    tokensConsumed: number;
    brandName?: string;
    domain?: string;
    aiScore?: number;
    completedAt?: string;
    createdAt: string;
  }>;
  lastUpdated: string;
}

interface AlertsBannerProps {
  dashboardStats: DashboardStats | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
  };
  icon?: React.ReactNode;
  dismissible?: boolean;
}

export function AlertsBanner({ dashboardStats, isLoading = false, onRefresh }: AlertsBannerProps) {
  const { t } = useTranslation();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    if (!dashboardStats || isLoading) {
      setAlerts([]);
      return;
    }

    const newAlerts: AlertItem[] = [];

    // Alert 1: Token balance low (< 10 tokens)
    if (dashboardStats.tokensRemaining < 10 && dashboardStats.tokensRemaining > 0) {
      newAlerts.push({
        id: 'low-tokens',
        type: 'warning',
        title: t('dashboard.alerts.lowTokens.title', 'Low Token Balance'),
        message: t('dashboard.alerts.lowTokens.message', `You have ${dashboardStats.tokensRemaining} tokens remaining. Consider topping up to avoid interruptions.`),
        icon: <CreditCard className="h-4 w-4" />,
        action: {
          label: t('dashboard.alerts.lowTokens.action', 'Top Up'),
          onClick: () => {
            window.location.href = '/settings/subscription';
          },
          variant: 'outline',
        },
        dismissible: true,
      });
    }

    // Alert 2: No tokens remaining
    if (dashboardStats.tokensRemaining === 0) {
      newAlerts.push({
        id: 'no-tokens',
        type: 'error',
        title: t('dashboard.alerts.noTokens.title', 'No Tokens Remaining'),
        message: t('dashboard.alerts.noTokens.message', 'You have no tokens left. Top up to continue evaluating offers.'),
        icon: <AlertTriangle className="h-4 w-4" />,
        action: {
          label: t('dashboard.alerts.noTokens.action', 'Top Up Now'),
          onClick: () => {
            window.location.href = '/settings/subscription';
          },
          variant: 'default',
        },
        dismissible: false,
      });
    }

    // Alert 3: Failed evaluations
    if (dashboardStats.aiEvaluationsFailed > 0) {
      newAlerts.push({
        id: 'failed-evaluations',
        type: 'warning',
        title: t('dashboard.alerts.failedEvaluations.title', 'Failed Evaluations'),
        message: t('dashboard.alerts.failedEvaluations.message', `${dashboardStats.aiEvaluationsFailed} evaluation${dashboardStats.aiEvaluationsFailed > 1 ? 's' : ''} failed. Check your offers and try again.`),
        icon: <AlertTriangle className="h-4 w-4" />,
        action: {
          label: t('dashboard.alerts.failedEvaluations.action', 'View Details'),
          onClick: () => {
            window.location.href = '/offers';
          },
          variant: 'outline',
        },
        dismissible: true,
      });
    }

    // Alert 4: Pending evaluations (> 5)
    if (dashboardStats.pendingEvaluations > 5) {
      newAlerts.push({
        id: 'pending-evaluations',
        type: 'info',
        title: t('dashboard.alerts.pendingEvaluations.title', 'Pending Evaluations'),
        message: t('dashboard.alerts.pendingEvaluations.message', `You have ${dashboardStats.pendingEvaluations} evaluations in progress.`),
        icon: <RefreshCw className="h-4 w-4" />,
        action: {
          label: t('dashboard.alerts.pendingEvaluations.action', 'View Progress'),
          onClick: () => {
            window.location.href = '/offers';
          },
          variant: 'outline',
        },
        dismissible: true,
      });
    }

    // Alert 5: No offers yet
    if (dashboardStats.totalOffers === 0) {
      newAlerts.push({
        id: 'no-offers',
        type: 'info',
        title: t('dashboard.alerts.noOffers.title', 'Get Started'),
        message: t('dashboard.alerts.noOffers.message', 'Create your first offer to start evaluating affiliate opportunities.'),
        icon: <Calendar className="h-4 w-4" />,
        action: {
          label: t('dashboard.alerts.noOffers.action', 'Create Offer'),
          onClick: () => {
            window.location.href = '/offers';
          },
          variant: 'default',
        },
        dismissible: true,
      });
    }

    // Alert 6: High AI failure rate (> 30%)
    if (dashboardStats.aiEvaluationsTotal > 5) {
      const failureRate = (dashboardStats.aiEvaluationsFailed / dashboardStats.aiEvaluationsTotal) * 100;
      if (failureRate > 30) {
        newAlerts.push({
          id: 'high-failure-rate',
          type: 'warning',
          title: t('dashboard.alerts.highFailureRate.title', 'High AI Failure Rate'),
          message: t('dashboard.alerts.highFailureRate.message', `${failureRate.toFixed(1)}}% of AI evaluations failed. Check your offers and settings.`),
          icon: <AlertTriangle className="h-4 w-4" />,
          action: {
            label: t('dashboard.alerts.highFailureRate.action', 'Troubleshoot'),
            onClick: () => {
              window.location.href = '/resources';
            },
            variant: 'outline',
          },
          dismissible: true,
        });
      }
    }

    setAlerts(newAlerts);
  }, [dashboardStats, isLoading, t]);

  const activeAlerts = alerts.filter(alert => !dismissedAlerts.has(alert.id));

  if (activeAlerts.length === 0) {
    return null;
  }

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...Array.from(prev), alertId]));
  };

  const getAlertVariant = (type: AlertItem['type']) => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'info':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <div className="flex flex-col gap-4 mb-6">
      {activeAlerts.map((alert) => (
        <Alert
          key={alert.id}
          variant={getAlertVariant(alert.type)}
          className="relative"
        >
          {alert.icon && (
            <div className="flex items-center">
              {alert.icon}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{alert.title}</h4>
              {alert.dismissible && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-transparent"
                  onClick={() => dismissAlert(alert.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <AlertDescription className="mt-1">
              {alert.message}
            </AlertDescription>
            {alert.action && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant={alert.action.variant || 'outline'}
                  onClick={alert.action.onClick}
                >
                  {alert.action.label}
                </Button>
              </div>
            )}
          </div>
        </Alert>
      ))}

      {/* Refresh button */}
      {onRefresh && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="text-xs text-muted-foreground"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('dashboard.alerts.refresh', 'Refresh Alerts')}
          </Button>
        </div>
      )}
    </div>
  );
}