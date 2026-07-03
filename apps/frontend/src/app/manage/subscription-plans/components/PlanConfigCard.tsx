'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '~/core/ui/Button';
import type { PlanConfig } from '~/lib/api/types/billing';

interface PlanConfigCardProps {
  plan: PlanConfig;
  onEdit: () => void;
  onViewHistory: () => void;
}

export function PlanConfigCard({ plan, onEdit, onViewHistory }: PlanConfigCardProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  // 获取显示名称
  const displayName = isZh ? plan.display_name_zh : plan.display_name_en;

  // 获取月付价格
  const monthlyPrice = plan.pricing?.monthly;
  const yearlyPrice = plan.pricing?.yearly;

  // 权限统计
  const enabledFeatures = Object.values(plan.permissions || {}).filter(
    v => v === true || (typeof v === 'number' && v > 0)
  ).length;
  const totalFeatures = Object.keys(plan.permissions || {}).length;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {/* 套餐标题 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{displayName}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {plan.tier.toUpperCase()} • v{plan.version}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            plan.is_active
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {plan.is_active ? t('common.active') : t('common.inactive')}
        </span>
      </div>

      {/* 价格 */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-baseline">
          <span className="text-2xl font-bold text-gray-900">
            {isZh ? '¥' : '$'}{monthlyPrice?.amount || 0}
          </span>
          <span className="ml-1 text-sm text-gray-600">
            {monthlyPrice?.display_suffix || '/m'}
          </span>
        </div>
        {yearlyPrice && (
          <div className="mt-2 text-sm text-gray-600">
            {t('manage.subscription_plans.yearly')}: {isZh ? '¥' : '$'}
            {yearlyPrice.amount}
            <span className="ml-2 text-xs text-green-600 font-medium">
              {isZh ? yearlyPrice.discount_label_zh : yearlyPrice.discount_label_en}
            </span>
          </div>
        )}
      </div>

      {/* Token配额 */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {t('manage.subscription_plans.monthly_tokens')}
          </span>
          <span className="font-semibold text-gray-900">
            {plan.monthly_tokens.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 权限概览 */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {t('manage.subscription_plans.features')}
          </span>
          <span className="font-medium text-gray-900">
            {enabledFeatures} / {totalFeatures}
          </span>
        </div>

        {/* 关键权限快速预览 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center">
            {plan.permissions?.offer_evaluation_ai ? (
              <span className="text-green-600">✓ AI{t('manage.subscription_plans.evaluation')}</span>
            ) : (
              <span className="text-gray-400">✗ AI{t('manage.subscription_plans.evaluation')}</span>
            )}
          </div>
          <div className="flex items-center">
            <span className="text-gray-700">
              {plan.permissions?.offer_evaluation_concurrency || 0}
              {t('manage.subscription_plans.concurrent')}
            </span>
          </div>
          <div className="flex items-center">
            {plan.permissions?.offer_link_replacement ? (
              <span className="text-green-600">✓ {t('manage.subscription_plans.link_replacement')}</span>
            ) : (
              <span className="text-gray-400">✗ {t('manage.subscription_plans.link_replacement')}</span>
            )}
          </div>
          <div className="flex items-center">
            <span className="text-gray-700">
              {plan.permissions?.ads_account_binding_limit || 0}
              {t('manage.subscription_plans.ads_accounts')}
            </span>
          </div>
        </div>
      </div>

      {/* Token消耗规则 */}
      <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-100">
        <h4 className="text-xs font-semibold text-blue-900 mb-2">
          {t('manage.subscription_plans.token_costs')}
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
          <div>
            {t('manage.subscription_plans.basic_eval')}: {plan.token_costs?.offer_evaluation_basic || 0}T
          </div>
          <div>
            {t('manage.subscription_plans.ai_eval')}: {plan.token_costs?.offer_evaluation_ai || 0}T
          </div>
          <div>
            {t('manage.subscription_plans.link_replace')}: {plan.token_costs?.offer_link_replacement || 0}T
          </div>
          <div>
            {t('manage.subscription_plans.autoclick')}: {plan.token_costs?.autoclick_per_success || 0}T
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex space-x-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={onEdit}
        >
          {t('common.edit')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onViewHistory}
        >
          {t('manage.subscription_plans.history')}
        </Button>
      </div>

      {/* 最后更新时间 */}
      <div className="mt-3 text-xs text-gray-400 text-center">
        {t('manage.subscription_plans.last_updated')}: {new Date(plan.updated_at).toLocaleString()}
      </div>
    </div>
  );
}
