'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubscriptionPermissions } from '~/core/hooks/use-billing-api';
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
import { Card, CardContent } from '~/core/ui/Card';
import {
  PencilIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
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

interface Permission {
  id: string;
  feature: string;
  category: string;
  description: string;
  starter: boolean;
  professional: boolean;
  elite: boolean;
}

export default function PermissionsConfigTab() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: permissions, isLoading, error, refetch } = useSubscriptionPermissions();

  const filteredPermissions = useMemo(() => {
    if (!permissions) return [];

    return permissions.filter((permission: Permission) => {
      const matchesSearch = searchQuery === '' ||
        permission.feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
        permission.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || permission.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [permissions, searchQuery, categoryFilter]);

  const categories = useMemo(() => {
    if (!permissions) return [];
    const uniqueCategories = Array.from(new Set(permissions.map((p: Permission) => p.category)));
    return uniqueCategories;
  }, [permissions]);

  const getPermissionIcon = (hasPermission: boolean) => {
    return hasPermission ? (
      <CheckCircleIcon className="h-5 w-5 text-green-500" />
    ) : (
      <XCircleIcon className="h-5 w-5 text-red-500" />
    );
  };

  
  const handleEditPermission = (permission: Permission) => {
    setEditingPermission(permission);
    setIsDialogOpen(true);
  };

  const handleAddPermission = () => {
    setEditingPermission(null);
    setIsDialogOpen(true);
  };

  const handleSavePermission = async (_permissionData: Partial<Permission>) => {
    try {
      // API call to save permission
      // await updatePermission(permissionData);
      await refetch();
      setIsDialogOpen(false);
      setEditingPermission(null);
    } catch (error) {
      console.error('Failed to save permission:', error);
    }
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{t('common.error', '加载权限配置失败')}</p>
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
            placeholder={t('manage.subscriptionConfig.searchFeature', '搜索功能...')}
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
            <Button onClick={handleAddPermission}>
              <PlusIcon className="h-4 w-4 mr-2" />
              {t('manage.subscriptionConfig.addPermission', '添加权限')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPermission
                  ? t('manage.subscriptionConfig.editPermission', '编辑权限')
                  : t('manage.subscriptionConfig.addPermission', '添加权限')
                }
              </DialogTitle>
            </DialogHeader>
            <PermissionEditForm
              permission={editingPermission}
              categories={categories}
              onSave={handleSavePermission}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Permissions Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('manage.subscriptionConfig.feature', '功能')}</TableHead>
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
                  <TableCell className="text-center"><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredPermissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('manage.subscriptionConfig.noPermissions', '暂无权限配置')}
                </TableCell>
              </TableRow>
            ) : (
              filteredPermissions.map((permission: Permission) => (
                <TableRow key={permission.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{permission.feature}</div>
                      <div className="text-sm text-muted-foreground">{permission.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{permission.category}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {getPermissionIcon(permission.starter)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getPermissionIcon(permission.professional)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getPermissionIcon(permission.elite)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditPermission(permission)}
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {permissions?.filter((p: Permission) => p.starter).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Starter {t('manage.subscriptionConfig.permissions', '权限数')}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {permissions?.filter((p: Permission) => p.professional).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Professional {t('manage.subscriptionConfig.permissions', '权限数')}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {permissions?.filter((p: Permission) => p.elite).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Elite {t('manage.subscriptionConfig.permissions', '权限数')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Permission Edit Form Component
function PermissionEditForm({
  permission,
  categories,
  onSave,
  onCancel,
}: {
  permission: Permission | null;
  categories: string[];
  onSave: (data: Partial<Permission>) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    feature: permission?.feature || '',
    category: permission?.category || (categories[0] || ''),
    description: permission?.description || '',
    starter: permission?.starter || false,
    professional: permission?.professional || false,
    elite: permission?.elite || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...permission,
      ...formData,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="feature">{t('manage.subscriptionConfig.feature', '功能名称')}</Label>
          <Input
            id="feature"
            value={formData.feature}
            onChange={(e) => setFormData({ ...formData, feature: e.target.value })}
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
        <Label>{t('manage.subscriptionConfig.planPermissions', '套餐权限')}</Label>
        <div className="grid grid-cols-3 gap-4 mt-2">
          {[
            { key: 'starter', label: 'Starter' },
            { key: 'professional', label: 'Professional' },
            { key: 'elite', label: 'Elite' },
          ].map((plan) => (
            <div key={plan.key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={plan.key}
                checked={formData[plan.key as keyof typeof formData] as boolean}
                onChange={(e) => setFormData({
                  ...formData,
                  [plan.key]: e.target.checked
                })}
                className="rounded border-gray-300"
              />
              <Label htmlFor={plan.key}>{plan.label}</Label>
            </div>
          ))}
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