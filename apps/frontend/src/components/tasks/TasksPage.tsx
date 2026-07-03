'use client';

import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

import { DashboardPageLayout } from '~/core/ui/PageLayout';
import Button from '~/core/ui/Button';
import Alert from '~/core/ui/Alert';
import Badge from '~/core/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';
import { PermissionGuard } from '~/components/PermissionGuard';
import LazyRender from '~/core/ui/LazyRender';

// Hooks
import { useTasks, useCancelTask, useRetryTask } from '~/lib/tasks';

// Components
import { TasksTable } from './TasksTable';

export function TasksPage() {
  const { t } = useTranslation('common');
  
  // Fetch tasks data
  const { tasks, isLoading, error, mutate } = useTasks({
    limit: 50,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  // Task actions
  const cancelTask = useCancelTask();
  const retryTask = useRetryTask();

  
  // Get subscription information and permissions
  const {
    subscription,
    permissions,
    isLoading: subscriptionLoading,
    canCreateOffers,
    canUseAI,
    needsUpgrade,
    isOnTrial
  } = useEnhancedSubscription();

  const taskLimits = useMemo(() => {
    if (!subscription) return { maxTasks: 5, maxScheduledTasks: 2, canUseAI: false };

    switch (subscription.tier) {
      case 'trial':
        return { maxTasks: 5, maxScheduledTasks: 2, canUseAI: false };
      case 'pro':
        return { maxTasks: 20, maxScheduledTasks: 10, canUseAI: true };
      case 'max':
        return { maxTasks: 50, maxScheduledTasks: 25, canUseAI: true };
      case 'elite':
        return { maxTasks: -1, maxScheduledTasks: -1, canUseAI: true }; // unlimited
      default:
        return { maxTasks: 5, maxScheduledTasks: 2, canUseAI: false };
    }
  }, [subscription]);

  // Task statistics
  const taskStats = useMemo(() => {
    return {
      running: tasks.filter((t) => t.status === 'running').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
    };
  }, [tasks]);

  // Handlers
  const handleCancelTask = async (taskId: string) => {
    try {
      await cancelTask({ taskId, reason: 'User cancelled' });
      toast.success(t('tasks.success.cancelled', 'Task cancelled successfully'));
      mutate();
    } catch (error) {
      toast.error(t('tasks.errors.cancelFailed', 'Failed to cancel task'));
    }
  };

  const handleRetryTask = async (taskId: string) => {
    try {
      await retryTask({ taskId });
      toast.success(t('tasks.success.retried', 'Task retried successfully'));
      mutate();
    } catch (error) {
      toast.error(t('tasks.errors.retryFailed', 'Failed to retry task'));
    }
  };

  const handleViewDetails = (task: any) => {
    // TODO: Implement task details modal/dialog
    // For now, just show a toast notification
    toast.info(t('tasks.ui.detailsComingSoon', 'Task details view coming soon'));
  };

  return (
    <DashboardPageLayout
      header={{
        title: t('tasks.ui.title', 'Tasks Management'),
        description: t('tasks.ui.description', 'Monitor and manage your automation tasks'),
        actions: (
          <div className="flex items-center gap-2">
            <Button size={'sm'} disabled={taskLimits.maxTasks !== -1 && tasks.length >= taskLimits.maxTasks} className="hidden sm:inline-flex">
              {t('tasks.ui.createTask', 'Create Task')}
            </Button>
            <Button size={'sm'} disabled={taskLimits.maxTasks !== -1 && tasks.length >= taskLimits.maxTasks} className="sm:hidden px-3">
              <span className="text-lg">+</span>
            </Button>
            {taskLimits.maxTasks !== -1 && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {tasks.length}/{taskLimits.maxTasks}
              </span>
            )}
          </div>
        ),
      }}
    >
      <div className={'flex flex-col gap-6'}>
        {/* Subscription status for task features */}
        {subscription && (
          <Alert type={canUseAI ? 'success' : 'info'}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm">
                <strong>
                  {canUseAI
                    ? t('tasks.ui.aiTasksEnabled', 'AI任务功能已启用')
                    : t('tasks.ui.basicTasksOnly', '仅基础任务功能可用')}
                </strong>
                <p className="text-muted-foreground mt-1">
                  {t('tasks.ui.taskLimits', '任务限制: {{maxTasks}} 个并发任务, {{maxScheduled}} 个定时任务', {
                    maxTasks: taskLimits.maxTasks === -1 ? t('common.unlimited', '无限制') : taskLimits.maxTasks,
                    maxScheduled: taskLimits.maxScheduledTasks === -1 ? t('common.unlimited', '无限制') : taskLimits.maxScheduledTasks
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {subscription.tier} {t('tasks.ui.plan', '套餐')}
                </Badge>
                {isOnTrial && (
                  <Badge variant="secondary">
                    {t('tasks.ui.trial', '试用')}
                  </Badge>
                )}
              </div>
            </div>
          </Alert>
        )}

        {/* Task limit warning */}
        {taskLimits.maxTasks !== -1 && tasks.length >= taskLimits.maxTasks && (
          <Alert type={'warn'}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className={'text-sm text-muted-foreground'}>
                {t('tasks.ui.taskLimitReached', '已达到任务数量限制')}
              </span>
              <Button
                size={'sm'}
                variant={'outline'}
                onClick={() => {
                  window.location.href = '/settings/subscription';
                }}
                className="w-full sm:w-auto"
              >
                {t('tasks.ui.upgradeForMore', '升级获得更多')}
              </Button>
            </div>
          </Alert>
        )}

        {/* Task statistics */}
        <LazyRender>
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-blue-600 mb-2">
                  {taskStats.running}
                </div>
                <div className="text-sm font-medium">{t('tasks.ui.running', '运行中')}</div>
                <div className="text-xs text-muted-foreground hidden sm:block">{t('tasks.ui.currentlyExecuting', '当前执行中')}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-green-600 mb-2">
                  {taskStats.completed}
                </div>
                <div className="text-sm font-medium">{t('tasks.ui.completed', '已完成')}</div>
                <div className="text-xs text-muted-foreground hidden sm:block">{t('tasks.ui.last24Hours', '最近24小时')}</div>
              </CardContent>
            </Card>

          <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-yellow-600 mb-2">
                  {taskStats.pending}
                </div>
                <div className="text-sm font-medium">{t('tasks.ui.pending', '等待中')}</div>
                <div className="text-xs text-muted-foreground hidden sm:block">{t('tasks.ui.queuedForExecution', '等待执行')}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-red-600 mb-2">
                  {taskStats.failed}
                </div>
                <div className="text-sm font-medium">{t('tasks.ui.failed', '失败')}</div>
                <div className="text-xs text-muted-foreground hidden sm:block">{t('tasks.ui.requiresAttention', '需要关注')}</div>
              </CardContent>
            </Card>
          </div>
        </LazyRender>

        {/* Tasks list */}
        <TasksTable
          tasks={tasks}
          isLoading={isLoading}
          onCancel={handleCancelTask}
          onRetry={handleRetryTask}
          onViewDetails={handleViewDetails}
        />

        {/* Task types with permission controls */}
        <LazyRender>
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-1 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{t('tasks.ui.offerEvaluation', 'Offer评估')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('tasks.ui.offerEvaluationDesc', '使用AI和流量数据自动分析affiliate offers')}
              </p>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant={canUseAI ? 'default' : 'secondary'}>
                  {canUseAI ? 'AI' : '基础'}
                </Badge>
                {canUseAI && (
                  <Badge variant="outline">
                    {subscription?.currentTokenBalance || 0} tokens
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={!canUseAI && subscription?.tier === 'trial'}
              >
                {t('tasks.ui.scheduleEvaluation', '计划评估')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('tasks.ui.performanceMonitoring', '性能监控')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('tasks.ui.performanceMonitoringDesc', '跟踪广告活动性能并发送优化建议提醒')}
              </p>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">
                  {t('tasks.ui.allPlans', '所有套餐')}
                </Badge>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                {t('tasks.ui.setupMonitoring', '设置监控')}
              </Button>
            </CardContent>
          </Card>

          <PermissionGuard requirePermission="useAI" fallback={
            <Card className="opacity-60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t('tasks.ui.batchProcessing', '批量处理')}
                  <Badge variant="destructive">
                    {t('tasks.ui.premium', '高级')}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('tasks.ui.batchProcessingDesc', '批量处理多个offers和数据分析')}
                </p>
                <Button variant="outline" size="sm" className="w-full" disabled>
                  {t('tasks.ui.setupBatchProcessing', '设置批量处理')}
                </Button>
              </CardContent>
            </Card>
          }>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t('tasks.ui.batchProcessing', '批量处理')}
                  <Badge variant="default">
                    {t('tasks.ui.aiPowered', 'AI驱动')}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('tasks.ui.batchProcessingDesc', '批量处理多个offers和数据分析')}
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline">
                    {t('tasks.ui.professionalElite', 'Professional/Elite')}
                  </Badge>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  {t('tasks.ui.setupBatchProcessing', '设置批量处理')}
                </Button>
              </CardContent>
            </Card>
          </PermissionGuard>
        </div>
        </LazyRender>
      </div>
    </DashboardPageLayout>
  );
}