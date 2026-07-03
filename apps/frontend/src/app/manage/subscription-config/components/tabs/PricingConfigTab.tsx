'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { Skeleton } from '~/core/ui/Skeleton';
import {
  PencilIcon,
  PlusIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { Input } from '~/core/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/core/ui/Dialog';
import { Label } from '~/core/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';

interface PricingPlan {
  id: string;
  name: string;
  tier: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  features: string[];
  monthlyTokens: number;
  maxUsers: number;
  isActive: boolean;
  sortOrder: number;
  highlighted: boolean;
}

export default function PricingConfigTab() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data - replace with actual API call
  const { data: pricingPlans, isLoading, error, refetch } = useSubscriptionPricing();

  const filteredPlans = useMemo(() => {
    if (!pricingPlans) return [];

    return pricingPlans.filter((plan: PricingPlan) => {
      const matchesSearch = searchQuery === '' ||
        plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.tier.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [pricingPlans, searchQuery]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency || 'CNY',
    }).format(amount);
  };

  const getTierIcon = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'elite':
        return <StarIcon className="h-5 w-5 text-purple-600" />;
      case 'professional':
        return <StarIcon className="h-5 w-5 text-green-600" />;
      case 'starter':
        return <StarIcon className="h-5 w-5 text-blue-600" />;
      default:
        return <StarIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getPlanBadgeVariant = (plan: PricingPlan) => {
    if (!plan.isActive) return 'secondary';
    if (plan.highlighted) return 'default';
    return 'outline';
  };

  const handleEditPlan = (plan: PricingPlan) => {
    setEditingPlan(plan);
    setIsDialogOpen(true);
  };

  const handleAddPlan = () => {
    setEditingPlan(null);
    setIsDialogOpen(true);
  };

  const handleSavePlan = async (_planData: Partial<PricingPlan>) => {
    try {
      // API call to save pricing plan
      // await updatePricingPlan(planData);
      await refetch();
      setIsDialogOpen(false);
      setEditingPlan(null);
    } catch (error) {
      console.error('Failed to save pricing plan:', error);
    }
  };

  const handleToggleActive = async (_plan: PricingPlan) => {
    try {
      // API call to toggle plan active status
      // await updatePricingPlan({ ..._plan, isActive: !_plan.isActive });
      await refetch();
    } catch (error) {
      console.error('Failed to toggle plan status:', error);
    }
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{t('common.error', '加载价格配置失败')}</p>
        <Button onClick={() => refetch()} className="mt-2">
          {t('common.retry', '重试')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 max-w-md">
          <Input
            placeholder={t('manage.subscriptionConfig.searchPlan', '搜索套餐...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddPlan}>
              <PlusIcon className="h-4 w-4 mr-2" />
              {t('manage.subscriptionConfig.addPlan', '添加套餐')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {editingPlan
                  ? t('manage.subscriptionConfig.editPlan', '编辑套餐')
                  : t('manage.subscriptionConfig.addPlan', '添加套餐')}
              </DialogTitle>
            </DialogHeader>
            <PricingPlanEditForm
              plan={editingPlan}
              onSave={handleSavePlan}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Pricing Plans Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('manage.subscriptionConfig.plan', '套餐')}</TableHead>
              <TableHead>{t('manage.subscriptionConfig.monthlyPrice', '月费')}</TableHead>
              <TableHead>{t('manage.subscriptionConfig.yearlyPrice', '年费')}</TableHead>
              <TableHead>{t('manage.subscriptionConfig.monthlyTokens', '月Token')}</TableHead>
              <TableHead>{t('manage.subscriptionConfig.maxUsers', '最大用户')}</TableHead>
              <TableHead>{t('common.status', '状态')}</TableHead>
              <TableHead className="text-right">{t('common.actions', '操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredPlans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('manage.subscriptionConfig.noPlans', '暂无套餐配置')}
                </TableCell>
              </TableRow>
            ) : (
              filteredPlans
                .sort((a: PricingPlan, b: PricingPlan) => a.sortOrder - b.sortOrder)
                .map((plan: PricingPlan) => (
                  <TableRow key={plan.id} className={!plan.isActive ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTierIcon(plan.tier)}
                        <div>
                          <div className="font-medium">{plan.name}</div>
                          <div className="text-sm text-muted-foreground">{plan.tier}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(plan.monthlyPrice, plan.currency)}
                      </div>
                      <div className="text-sm text-muted-foreground">/月</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(plan.yearlyPrice, plan.currency)}
                      </div>
                      <div className="text-sm text-muted-foreground">/年</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{plan.monthlyTokens.toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {plan.maxUsers === -1 ? t('common.unlimited', '无限制') : plan.maxUsers}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPlanBadgeVariant(plan)}>
                        {plan.highlighted && <StarIcon className="h-3 w-3 mr-1" />}
                        {plan.isActive ? t('common.active', '启用') : t('common.inactive', '禁用')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(plan)}
                        >
                          {plan.isActive ? t('common.disable', '禁用') : t('common.enable', '启用')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPlan(plan)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pricing Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {t('manage.subscriptionConfig.totalPlans', '套餐总数')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pricingPlans?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {t('manage.subscriptionConfig.activePlans', '启用套餐')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {pricingPlans?.filter((p: PricingPlan) => p.isActive).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {t('manage.subscriptionConfig.avgMonthlyPrice', '平均月费')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {pricingPlans && pricingPlans.length > 0
                ? formatCurrency(
                    pricingPlans.reduce((sum: number, plan: PricingPlan) => sum + plan.monthlyPrice, 0) /
                    pricingPlans.filter((p: PricingPlan) => p.isActive).length,
                    pricingPlans[0].currency
                  )
                : formatCurrency(0, 'CNY')
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {t('manage.subscriptionConfig.totalTokens', '总Token配额')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {pricingPlans?.reduce((sum: number, plan: PricingPlan) => sum + plan.monthlyTokens, 0).toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Mock hook - replace with actual implementation
function useSubscriptionPricing() {
  const mockPricingPlans: PricingPlan[] = [
    {
      id: '1',
      name: 'Starter',
      tier: 'starter',
      monthlyPrice: 298,
      yearlyPrice: 2980,
      currency: 'CNY',
      features: ['基础功能', '每月1000 Token', '邮件支持'],
      monthlyTokens: 1000,
      maxUsers: 1,
      isActive: true,
      sortOrder: 1,
      highlighted: false,
    },
    {
      id: '2',
      name: 'Professional',
      tier: 'professional',
      monthlyPrice: 998,
      yearlyPrice: 9980,
      currency: 'CNY',
      features: ['高级功能', '每月5000 Token', 'AI评估', '优先支持'],
      monthlyTokens: 5000,
      maxUsers: 5,
      isActive: true,
      sortOrder: 2,
      highlighted: true,
    },
    {
      id: '3',
      name: 'Elite',
      tier: 'elite',
      monthlyPrice: 2998,
      yearlyPrice: 29980,
      currency: 'CNY',
      features: ['全部功能', '无限Token', 'AI评估', '专属支持', '定制服务'],
      monthlyTokens: 20000,
      maxUsers: -1,
      isActive: true,
      sortOrder: 3,
      highlighted: false,
    },
  ];

  return {
    data: mockPricingPlans,
    isLoading: false,
    error: null,
    refetch: async () => {
      // Mock refresh
    },
  };
}

// Pricing Plan Edit Form Component
function PricingPlanEditForm({
  plan,
  onSave,
  onCancel,
}: {
  plan: PricingPlan | null;
  onSave: (data: Partial<PricingPlan>) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    tier: plan?.tier || '',
    monthlyPrice: plan?.monthlyPrice || 0,
    yearlyPrice: plan?.yearlyPrice || 0,
    currency: plan?.currency || 'CNY',
    features: plan?.features?.join('\n') || '',
    monthlyTokens: plan?.monthlyTokens || 0,
    maxUsers: plan?.maxUsers || 1,
    isActive: plan?.isActive ?? true,
    sortOrder: plan?.sortOrder || 1,
    highlighted: plan?.highlighted ?? false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...plan,
      ...formData,
      features: formData.features.split('\n').filter(f => f.trim()),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">{t('manage.subscriptionConfig.planName', '套餐名称')}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="tier">{t('manage.subscriptionConfig.tier', '等级')}</Label>
          <Input
            id="tier"
            value={formData.tier}
            onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="monthlyPrice">{t('manage.subscriptionConfig.monthlyPrice', '月费')}</Label>
          <Input
            id="monthlyPrice"
            type="number"
            min="0"
            value={formData.monthlyPrice}
            onChange={(e) => setFormData({ ...formData, monthlyPrice: parseFloat(e.target.value) || 0 })}
            required
          />
        </div>
        <div>
          <Label htmlFor="yearlyPrice">{t('manage.subscriptionConfig.yearlyPrice', '年费')}</Label>
          <Input
            id="yearlyPrice"
            type="number"
            min="0"
            value={formData.yearlyPrice}
            onChange={(e) => setFormData({ ...formData, yearlyPrice: parseFloat(e.target.value) || 0 })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="currency">{t('manage.subscriptionConfig.currency', '货币')}</Label>
          <Input
            id="currency"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="monthlyTokens">{t('manage.subscriptionConfig.monthlyTokens', '月Token')}</Label>
          <Input
            id="monthlyTokens"
            type="number"
            min="0"
            value={formData.monthlyTokens}
            onChange={(e) => setFormData({ ...formData, monthlyTokens: parseInt(e.target.value) || 0 })}
            required
          />
        </div>
        <div>
          <Label htmlFor="maxUsers">{t('manage.subscriptionConfig.maxUsers', '最大用户数')}</Label>
          <Input
            id="maxUsers"
            type="number"
            min="-1"
            value={formData.maxUsers}
            onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 1 })}
            required
          />
          <div className="text-xs text-muted-foreground mt-1">
            -1 = {t('common.unlimited', '无限制')}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="features">{t('manage.subscriptionConfig.features', '功能特性')}</Label>
        <textarea
          id="features"
          value={formData.features}
          onChange={(e) => setFormData({ ...formData, features: e.target.value })}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={t('manage.subscriptionConfig.featuresPlaceholder', '每行一个功能特性')}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center space-x-2 pt-6">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({
              ...formData,
              isActive: e.target.checked
            })}
            className="rounded border-gray-300"
          />
          <Label htmlFor="isActive">{t('common.active', '启用')}</Label>
        </div>
        <div className="flex items-center space-x-2 pt-6">
          <input
            type="checkbox"
            id="highlighted"
            checked={formData.highlighted}
            onChange={(e) => setFormData({
              ...formData,
              highlighted: e.target.checked
            })}
            className="rounded border-gray-300"
          />
          <Label htmlFor="highlighted">{t('manage.subscriptionConfig.recommended', '推荐')}</Label>
        </div>
        <div>
          <Label htmlFor="sortOrder">{t('manage.subscriptionConfig.sortOrder', '排序')}</Label>
          <Input
            id="sortOrder"
            type="number"
            min="1"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 1 })}
            required
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel', '取消')}
        </Button>
        <Button type="submit">
          {t('common.save', '保存')}
        </Button>
      </div>
    </form>
  );
}