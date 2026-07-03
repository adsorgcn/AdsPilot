'use client';

/**
 * 订阅套餐配置管理页面
 * 路径: /manage/subscription-plans
 * 权限: 仅管理员可访问
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import { Button } from '~/core/ui/Button';
import { Alert } from '~/core/ui/Alert';
import { PlanConfigCard } from './components/PlanConfigCard';
import { PlanEditDialog } from './components/PlanEditDialog';
import { ConfigHistoryDialog } from './components/ConfigHistoryDialog';
import type { PlanConfig } from '~/lib/api/types/billing';
import type { SubscriptionPlanUpdate, SubscriptionPlanResponse } from '~/lib/types/subscription-plans';
import { createLogger } from '~/lib/utils/logger';

const logger = createLogger('SubscriptionPlans');

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SubscriptionPlansManagePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedPlan, setSelectedPlan] = useState<PlanConfig | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>('');

  // 获取所有套餐配置
  const { data: plansResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: () => fetcher('/api/v1/billing/plans'),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // 每30秒自动刷新
    refetchIntervalInBackground: false,
  });

  // 保存套餐配置的 mutation
  const savePlanMutation = useMutation<
    SubscriptionPlanResponse,
    Error,
    SubscriptionPlanUpdate
  >({
    mutationFn: async (updatedData: SubscriptionPlanUpdate) => {
      const response = await fetch('/api/v1/admin/subscription-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save subscription plan');
      }

      return response.json();
    },
    onSuccess: () => {
      setSelectedPlan(null);
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] });
      logger.info('Subscription plan saved successfully');
    },
    onError: (error) => {
      logger.error('Error saving subscription plan', error);
      // Handle error appropriately (e.g., show toast notification)
    },
  });

  const plans = plansResponse?.data || [];

  const handleEdit = (plan: PlanConfig) => {
    setSelectedPlan(plan);
  };

  const handleViewHistory = (tier: string) => {
    setSelectedTier(tier);
    setShowHistory(true);
  };

  const handleSave = (updatedData: Partial<PlanConfig>) => {
    // Transform Partial<PlanConfig> to SubscriptionPlanUpdate format
    const transformedData: SubscriptionPlanUpdate = {
      tier: updatedData.tier || '',
      name: updatedData.display_name_en || updatedData.display_name_zh || '',
      price: 0, // Extract from pricing if needed
      features: updatedData.permissions ? Object.keys(updatedData.permissions) : [],
      limits: {
        tokens: updatedData.monthly_tokens || 0,
        offers: updatedData.permissions?.offers ? 1 : 0,
        tasks: updatedData.permissions?.tasks ? 1 : 0,
      },
    };
    savePlanMutation.mutate(transformedData);
  };

  if (isLoading) {
    return (
      <AdminPageLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">{t('common.loading')}</p>
        </div>
      </AdminPageLayout>
    );
  }

  if (error) {
    return (
      <AdminPageLayout>
        <Alert variant="destructive">
          {t('manage.subscription_plans.load_error')}
        </Alert>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('manage.subscription_plans.title')}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('manage.subscription_plans.subtitle')}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => refetch()}
          >
            {t('common.refresh')}
          </Button>
        </div>

        {/* 热更新提示 */}
        <Alert type="info">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-blue-500 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                {t('manage.subscription_plans.hot_reload_info.title')}
              </h3>
              <p className="mt-1 text-sm text-blue-700">
                {t('manage.subscription_plans.hot_reload_info.description')}
              </p>
            </div>
          </div>
        </Alert>

        {/* 套餐配置卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan: PlanConfig) => (
            <PlanConfigCard
              key={plan.tier}
              plan={plan}
              onEdit={() => handleEdit(plan)}
              onViewHistory={() => handleViewHistory(plan.tier)}
            />
          ))}
        </div>

        {/* 编辑对话框 */}
        {selectedPlan && (
          <PlanEditDialog
            plan={selectedPlan}
            isOpen={!!selectedPlan}
            onClose={() => setSelectedPlan(null)}
            onSave={handleSave}
          />
        )}

        {/* 变更历史对话框 */}
        {showHistory && (
          <ConfigHistoryDialog
            planTier={selectedTier}
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </AdminPageLayout>
  );
}
