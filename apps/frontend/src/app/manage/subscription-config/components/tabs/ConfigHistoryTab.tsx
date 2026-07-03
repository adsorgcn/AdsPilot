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
  EyeIcon,
  ArrowPathIcon,
  ClockIcon,
  UserIcon,
  CogIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { Input } from '~/core/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/core/ui/Dialog';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';

interface ConfigHistoryItem {
  id: string;
  configType: 'permission' | 'token_cost' | 'pricing';
  configId: string;
  configName: string;
  action: 'create' | 'update' | 'delete';
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  description: string;
}

export default function ConfigHistoryTab() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [configTypeFilter, setConfigTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedHistory, setSelectedHistory] = useState<ConfigHistoryItem | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Mock data - replace with actual API call
  const { data: historyItems, isLoading, error, mutate } = useConfigHistory();

  const filteredHistory = useMemo(() => {
    if (!historyItems) return [];

    return historyItems.filter((item: ConfigHistoryItem) => {
      const matchesSearch = searchQuery === '' ||
        item.configName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.changedByName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesConfigType = configTypeFilter === 'all' || item.configType === configTypeFilter;
      const matchesAction = actionFilter === 'all' || item.action === actionFilter;

      return matchesSearch && matchesConfigType && matchesAction;
    });
  }, [historyItems, searchQuery, configTypeFilter, actionFilter]);

  const getConfigTypeIcon = (type: string) => {
    switch (type) {
      case 'permission':
        return <ShieldCheckIcon className="h-4 w-4" />;
      case 'token_cost':
        return <CurrencyDollarIcon className="h-4 w-4" />;
      case 'pricing':
        return <CogIcon className="h-4 w-4" />;
      default:
        return <CogIcon className="h-4 w-4" />;
    }
  };

  const getConfigTypeLabel = (type: string) => {
    switch (type) {
      case 'permission':
        return t('manage.subscriptionConfig.permissions', '权限配置');
      case 'token_cost':
        return t('manage.subscriptionConfig.tokenCosts', 'Token消耗');
      case 'pricing':
        return t('manage.subscriptionConfig.pricing', '套餐价格');
      default:
        return type;
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'create':
        return 'default';
      case 'update':
        return 'outline';
      case 'delete':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(dateString));
  };

  const handleViewDetail = (item: ConfigHistoryItem) => {
    setSelectedHistory(item);
    setIsDetailDialogOpen(true);
  };

  const handleRefresh = () => {
    mutate();
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{t('common.error', '加载变更历史失败')}</p>
        <Button onClick={handleRefresh} className="mt-2">
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
            placeholder={t('manage.subscriptionConfig.searchHistory', '搜索历史记录...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64"
          />

          <Select value={configTypeFilter} onValueChange={setConfigTypeFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder={t('manage.subscriptionConfig.selectConfigType', '选择配置类型')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all', '全部类型')}</SelectItem>
              <SelectItem value="permission">{t('manage.subscriptionConfig.permissions', '权限配置')}</SelectItem>
              <SelectItem value="token_cost">{t('manage.subscriptionConfig.tokenCosts', 'Token消耗')}</SelectItem>
              <SelectItem value="pricing">{t('manage.subscriptionConfig.pricing', '套餐价格')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder={t('manage.subscriptionConfig.selectAction', '选择操作类型')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all', '全部操作')}</SelectItem>
              <SelectItem value="create">{t('common.create', '创建')}</SelectItem>
              <SelectItem value="update">{t('common.update', '更新')}</SelectItem>
              <SelectItem value="delete">{t('common.delete', '删除')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={handleRefresh}>
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          {t('common.refresh', '刷新')}
        </Button>
      </div>

      {/* History Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('manage.subscriptionConfig.config', '配置')}</TableHead>
              <TableHead>{t('manage.subscriptionConfig.action', '操作')}</TableHead>
              <TableHead>{t('manage.subscriptionConfig.changedBy', '操作人')}</TableHead>
              <TableHead>{t('manage.subscriptionConfig.description', '描述')}</TableHead>
              <TableHead>{t('manage.subscriptionConfig.changedAt', '时间')}</TableHead>
              <TableHead className="text-right">{t('common.actions', '操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredHistory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('manage.subscriptionConfig.noHistory', '暂无变更历史')}
                </TableCell>
              </TableRow>
            ) : (
              filteredHistory.map((item: ConfigHistoryItem) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getConfigTypeIcon(item.configType)}
                      <div>
                        <div className="font-medium">{item.configName}</div>
                        <div className="text-sm text-muted-foreground">
                          {getConfigTypeLabel(item.configType)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(item.action)}>
                      {t(`common.${item.action}`, item.action)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <span>{item.changedByName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={item.description}>
                      {item.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatDate(item.changedAt)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetail(item)}
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* History Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CogIcon className="h-4 w-4" />
              {t('manage.subscriptionConfig.totalChanges', '总变更次数')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {historyItems?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheckIcon className="h-4 w-4 text-blue-600" />
              {t('manage.subscriptionConfig.permissionChanges', '权限变更')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {historyItems?.filter((h: ConfigHistoryItem) => h.configType === 'permission').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CurrencyDollarIcon className="h-4 w-4 text-green-600" />
              {t('manage.subscriptionConfig.tokenCostChanges', 'Token消耗变更')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {historyItems?.filter((h: ConfigHistoryItem) => h.configType === 'token_cost').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowPathIcon className="h-4 w-4 text-purple-600" />
              {t('manage.subscriptionConfig.pricingChanges', '价格变更')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {historyItems?.filter((h: ConfigHistoryItem) => h.configType === 'pricing').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('manage.subscriptionConfig.changeDetail', '变更详情')}</DialogTitle>
          </DialogHeader>
          {selectedHistory && (
            <ConfigHistoryDetail historyItem={selectedHistory} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Mock hook - replace with actual implementation
function useConfigHistory() {
  const mockHistory: ConfigHistoryItem[] = [
    {
      id: '1',
      configType: 'permission',
      configId: 'perm-1',
      configName: 'AI评估权限',
      action: 'update',
      oldValue: { starter: false, professional: true, elite: true },
      newValue: { starter: false, professional: true, elite: true },
      changedBy: 'user-1',
      changedByName: '张三',
      changedAt: '2024-01-15T10:30:00Z',
      description: '启用AI评估功能权限配置',
    },
    {
      id: '2',
      configType: 'token_cost',
      configId: 'cost-1',
      configName: 'AI评估Token消耗',
      action: 'update',
      oldValue: { professionalCost: 100, eliteCost: 50 },
      newValue: { professionalCost: 50, eliteCost: 30 },
      changedBy: 'user-2',
      changedByName: '李四',
      changedAt: '2024-01-14T15:45:00Z',
      description: '降低AI评估功能的Token消耗成本',
    },
    {
      id: '3',
      configType: 'pricing',
      configId: 'plan-1',
      configName: 'Professional套餐',
      action: 'update',
      oldValue: { monthlyPrice: 898, yearlyPrice: 8980 },
      newValue: { monthlyPrice: 998, yearlyPrice: 9980 },
      changedBy: 'user-1',
      changedByName: '张三',
      changedAt: '2024-01-13T09:15:00Z',
      description: '调整Professional套餐价格',
    },
  ];

  return {
    data: mockHistory,
    isLoading: false,
    error: null,
    mutate: async () => {
      // Mock refresh
    },
  };
}

// Config History Detail Component
function ConfigHistoryDetail({ historyItem }: { historyItem: ConfigHistoryItem }) {
  const { t } = useTranslation();

  const formatJsonValue = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">{t('manage.subscriptionConfig.configInfo', '配置信息')}</h4>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('manage.subscriptionConfig.configName', '配置名称')}:</dt>
              <dd className="font-medium">{historyItem.configName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('manage.subscriptionConfig.configType', '配置类型')}:</dt>
              <dd>{historyItem.configType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('manage.subscriptionConfig.action', '操作')}:</dt>
              <dd>{historyItem.action}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h4 className="font-medium mb-2">{t('manage.subscriptionConfig.changeInfo', '变更信息')}</h4>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('manage.subscriptionConfig.operatedBy', '操作人')}:</dt>
              <dd>{historyItem.changedByName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('manage.subscriptionConfig.operatedAt', '操作时间')}:</dt>
              <dd>{new Date(historyItem.changedAt).toLocaleString('zh-CN')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('manage.subscriptionConfig.description', '描述')}:</dt>
              <dd className="text-right max-w-xs">{historyItem.description}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Value Changes */}
      <div>
        <h4 className="font-medium mb-4">{t('manage.subscriptionConfig.valueChanges', '值变更')}</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h5 className="text-sm font-medium text-muted-foreground mb-2">
              {t('manage.subscriptionConfig.oldValue', '原值')}
            </h5>
            <pre className="bg-muted p-3 rounded text-sm overflow-auto max-h-64">
              {formatJsonValue(historyItem.oldValue)}
            </pre>
          </div>
          <div>
            <h5 className="text-sm font-medium text-muted-foreground mb-2">
              {t('manage.subscriptionConfig.newValue', '新值')}
            </h5>
            <pre className="bg-muted p-3 rounded text-sm overflow-auto max-h-64">
              {formatJsonValue(historyItem.newValue)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}