'use client';

import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/core/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import {
  ShieldCheckIcon,
  CurrencyDollarIcon,
  CogIcon,
  ClockIcon,
  PlusIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

// Import tab components
import PermissionsConfigTab from './tabs/PermissionsConfigTab';
import TokenCostsConfigTab from './tabs/TokenCostsConfigTab';
import PricingConfigTab from './tabs/PricingConfigTab';
import ConfigHistoryTab from './tabs/ConfigHistoryTab';

type TabKey = 'permissions' | 'token-costs' | 'pricing' | 'history';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
}

export default function SubscriptionConfigManagement() {
  const { t } = useTranslation();

  const tabs: TabConfig[] = [
    {
      key: 'permissions',
      label: t('manage.subscriptionConfig.permissions', '权限配置'),
      icon: ShieldCheckIcon,
      description: t('manage.subscriptionConfig.permissionsDesc', '管理各套餐的功能权限配置'),
    },
    {
      key: 'token-costs',
      label: t('manage.subscriptionConfig.tokenCosts', 'Token消耗'),
      icon: CurrencyDollarIcon,
      description: t('manage.subscriptionConfig.tokenCostsDesc', '配置各功能的Token消耗规则'),
    },
    {
      key: 'pricing',
      label: t('manage.subscriptionConfig.pricing', '套餐价格'),
      icon: CogIcon,
      description: t('manage.subscriptionConfig.pricingDesc', '管理订阅套餐的价格配置'),
    },
    {
      key: 'history',
      label: t('manage.subscriptionConfig.history', '变更历史'),
      icon: ClockIcon,
      description: t('manage.subscriptionConfig.historyDesc', '查看配置变更历史记录'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CogIcon className="h-5 w-5" />
                {t('manage.subscriptionConfig.title', '订阅配置管理')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('manage.subscriptionConfig.description', '管理订阅套餐的权限、Token消耗和价格配置')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <EyeIcon className="h-4 w-4 mr-2" />
                {t('common.preview', '预览配置')}
              </Button>
              <Button size="sm" className="flex-1 sm:flex-initial">
                <PlusIcon className="h-4 w-4 mr-2" />
                {t('common.add', '添加配置')}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Configuration Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="permissions" className="w-full">
            <div className="border-b">
              <TabsList className="w-full h-auto flex flex-col sm:flex-row space-x-0 sm:space-x-1 space-y-1 sm:space-y-0 p-4 bg-muted/50 rounded-none justify-start">
                {tabs.map((tab) => {
                  const Icon = tab.icon;

                  return (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      className="w-full sm:w-auto justify-start gap-2 data-[state=active]:bg-background"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                      {tab.badge && (
                        <Badge
                          variant="secondary"
                          className="ml-1 h-5 px-1 text-xs"
                        >
                          {tab.badge}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {tabs.map((tab) => (
              <TabsContent key={tab.key} value={tab.key} className="mt-0">
                {/* Tab Description */}
                <div className="px-6 py-3 bg-muted/30 border-b">
                  <p className="text-sm text-muted-foreground">
                    {tab.description}
                  </p>
                </div>

                {/* Tab Content */}
                <div className="px-6 py-6">
                  {tab.key === 'permissions' && <PermissionsConfigTab />}
                  {tab.key === 'token-costs' && <TokenCostsConfigTab />}
                  {tab.key === 'pricing' && <PricingConfigTab />}
                  {tab.key === 'history' && <ConfigHistoryTab />}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
