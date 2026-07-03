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
  CurrencyDollarIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';

interface TokenCost {
  id: string;
  action: string;
  category: string;
  description: string;
  starterCost: number;
  professionalCost: number;
  eliteCost: number;
  unit: string;
  isActive: boolean;
}

export default function TokenCostsConfigTab() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingCost, setEditingCost] = useState<TokenCost | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data - replace with actual API call
  const { data: tokenCosts, isLoading, error, refetch } = useSubscriptionTokenCosts();

  const filteredCosts = useMemo(() => {
    if (!tokenCosts) return [];

    return tokenCosts.filter((cost: TokenCost) => {
      const matchesSearch = searchQuery === '' ||
        cost.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cost.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || cost.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [tokenCosts, searchQuery, categoryFilter]);

  const categories = useMemo(() => {
    if (!tokenCosts) return [];
    const uniqueCategories = Array.from(new Set(tokenCosts.map((c: TokenCost) => c.category)));
    return uniqueCategories;
  }, [tokenCosts]);

  const formatTokenCost = (cost: number, unit: string) => {
    return `${cost} ${unit}`;
  };

  const getCostBadgeVariant = (cost: number) => {
    if (cost === 0) return 'secondary';
    if (cost <= 10) return 'outline';
    if (cost <= 50) return 'default';
    return 'destructive';
  };

  const handleEditCost = (cost: TokenCost) => {
    setEditingCost(cost);
    setIsDialogOpen(true);
  };

  const handleAddCost = () => {
    setEditingCost(null);
    setIsDialogOpen(true);
  };

  const handleSaveCost = async (costData: Partial<TokenCost>) => {
    try {
      // API call to save token cost
      // await updateTokenCost(costData);
      console.log('Saving token cost:', costData);
      await refetch();
      setIsDialogOpen(false);
      setEditingCost(null);
    } catch (error) {
      console.error('Failed to save token cost:', error);
    }
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{t('common.error', '加载Token消耗配置失败')}</p>
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            placeholder={t('manage.subscriptionConfig.searchAction', '搜索操作...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64"
          />

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder={t('manage.subscriptionConfig.selectCategory', '选择分类')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all', '全部')}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddCost}>
              <PlusIcon className="h-4 w-4 mr-2" />
              {t('manage.subscriptionConfig.addTokenCost', '添加Token消耗')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCost
                  ? t('manage.subscriptionConfig.editTokenCost', '编辑Token消耗')
                  : t('manage.subscriptionConfig.addTokenCost', '添加Token消耗')
                }
              </DialogTitle>
            </DialogHeader>
            <TokenCostEditForm
              cost={editingCost}
              categories={categories}
              onSave={handleSaveCost}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Token Costs Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('manage.subscriptionConfig.action', '操作')}</TableHead>
              <TableHead>{t('manage.subscriptionConfig.category', '分类')}</TableHead>
              <TableHead className="text-center">Starter</TableHead>
              <TableHead className="text-center">Professional</TableHead>
              <TableHead className="text-center">Elite</TableHead>
              <TableHead className="text-right">{t('common.actions', '操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredCosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('manage.subscriptionConfig.noTokenCosts', '暂无Token消耗配置')}
                </TableCell>
              </TableRow>
            ) : (
              filteredCosts.map((cost: TokenCost) => (
                <TableRow key={cost.id} className={!cost.isActive ? 'opacity-60' : ''}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{cost.action}</div>
                      <div className="text-sm text-muted-foreground">{cost.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{cost.category}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getCostBadgeVariant(cost.starterCost)}>
                      {formatTokenCost(cost.starterCost, cost.unit)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getCostBadgeVariant(cost.professionalCost)}>
                      {formatTokenCost(cost.professionalCost, cost.unit)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getCostBadgeVariant(cost.eliteCost)}>
                      {formatTokenCost(cost.eliteCost, cost.unit)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditCost(cost)}
                      disabled={!cost.isActive}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cost Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CurrencyDollarIcon className="h-4 w-4 text-blue-600" />
              Starter {t('manage.subscriptionConfig.avgCost', '平均消耗')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {tokenCosts && tokenCosts.length > 0
                ? Math.round(
                    tokenCosts.reduce((sum: number, cost: TokenCost) => sum + cost.starterCost, 0) /
                    tokenCosts.filter((c: TokenCost) => c.isActive).length
                  )
                : 0
              } {tokenCosts?.[0]?.unit || 'tokens'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CurrencyDollarIcon className="h-4 w-4 text-green-600" />
              Professional {t('manage.subscriptionConfig.avgCost', '平均消耗')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tokenCosts && tokenCosts.length > 0
                ? Math.round(
                    tokenCosts.reduce((sum: number, cost: TokenCost) => sum + cost.professionalCost, 0) /
                    tokenCosts.filter((c: TokenCost) => c.isActive).length
                  )
                : 0
              } {tokenCosts?.[0]?.unit || 'tokens'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CurrencyDollarIcon className="h-4 w-4 text-purple-600" />
              Elite {t('manage.subscriptionConfig.avgCost', '平均消耗')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {tokenCosts && tokenCosts.length > 0
                ? Math.round(
                    tokenCosts.reduce((sum: number, cost: TokenCost) => sum + cost.eliteCost, 0) /
                    tokenCosts.filter((c: TokenCost) => c.isActive).length
                  )
                : 0
              } {tokenCosts?.[0]?.unit || 'tokens'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Mock hook - replace with actual implementation
function useSubscriptionTokenCosts() {
  const mockTokenCosts: TokenCost[] = [
    {
      id: '1',
      action: 'AI评估',
      category: 'AI功能',
      description: '使用AI进行Offer评估',
      starterCost: 0,
      professionalCost: 50,
      eliteCost: 30,
      unit: 'tokens',
      isActive: true,
    },
    {
      id: '2',
      action: '创建Offer',
      category: '基础功能',
      description: '创建新的Offer',
      starterCost: 10,
      professionalCost: 5,
      eliteCost: 3,
      unit: 'tokens',
      isActive: true,
    },
    {
      id: '3',
      action: '导出数据',
      category: '数据功能',
      description: '导出分析报告',
      starterCost: 20,
      professionalCost: 10,
      eliteCost: 5,
      unit: 'tokens',
      isActive: true,
    },
  ];

  return {
    data: mockTokenCosts,
    isLoading: false,
    error: null,
    refetch: async () => {
      // Mock refresh
    },
  };
}

// Token Cost Edit Form Component
function TokenCostEditForm({
  cost,
  categories,
  onSave,
  onCancel,
}: {
  cost: TokenCost | null;
  categories: string[];
  onSave: (data: Partial<TokenCost>) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    action: cost?.action || '',
    category: cost?.category || (categories[0] || ''),
    description: cost?.description || '',
    starterCost: cost?.starterCost || 0,
    professionalCost: cost?.professionalCost || 0,
    eliteCost: cost?.eliteCost || 0,
    unit: cost?.unit || 'tokens',
    isActive: cost?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...cost,
      ...formData,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="action">{t('manage.subscriptionConfig.action', '操作名称')}</Label>
          <Input
            id="action"
            value={formData.action}
            onChange={(e) => setFormData({ ...formData, action: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="category">{t('manage.subscriptionConfig.category', '分类')}</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">{t('manage.subscriptionConfig.description', '描述')}</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          required
        />
      </div>

      <div>
        <Label>{t('manage.subscriptionConfig.tokenCostsByPlan', '各套餐Token消耗')}</Label>
        <div className="grid grid-cols-3 gap-4 mt-2">
          {[
            { key: 'starterCost', label: 'Starter' },
            { key: 'professionalCost', label: 'Professional' },
            { key: 'eliteCost', label: 'Elite' },
          ].map((plan) => (
            <div key={plan.key}>
              <Label htmlFor={plan.key}>{plan.label}</Label>
              <Input
                id={plan.key}
                type="number"
                min="0"
                value={formData[plan.key as keyof typeof formData] as number}
                onChange={(e) => setFormData({
                  ...formData,
                  [plan.key]: parseInt(e.target.value) || 0
                })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="unit">{t('manage.subscriptionConfig.unit', '单位')}</Label>
          <Input
            id="unit"
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            required
          />
        </div>
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