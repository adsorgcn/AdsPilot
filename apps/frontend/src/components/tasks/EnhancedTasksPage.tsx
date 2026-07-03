'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
  Play,
  BarChart3,
} from 'lucide-react';

import { DashboardPageLayout } from '~/core/ui/PageLayout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '~/components/ui/GlassCard';
import { MetricCard } from '~/components/ui/MetricCard';
import { GradientButton } from '~/components/ui/GradientButton';
import Badge from '~/core/ui/Badge';
import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';
import { useTasks } from '~/lib/tasks';

// Phase 2 & 3 Components
import { TokenOverviewCard } from './TokenOverviewCard';
import { TaskTimelineView } from './TaskTimelineView';
import { PageTransition } from '~/components/ui/PageTransition';
import { SkeletonMetricCard } from '~/components/ui/SkeletonLoader';
import { EmptyDataState } from '~/components/ui/EmptyState';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '~/components/ui/KeyboardShortcuts';

// Phase 4 & 5 Components - Ready for integration
// import { PullToRefresh } from '~/components/mobile/PullToRefresh';
// import { VirtualList } from '~/components/performance/VirtualList';
// import { useIsMobile } from '~/hooks/useMediaQuery';

export function EnhancedTasksPage() {
  const { t } = useTranslation('common');
  // const isMobile = useIsMobile(); // Ready for mobile integration
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { tasks, isLoading, refetch } = useTasks({
    limit: 50,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const running = tasks.filter(t => t.status === 'running').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const totalTokens = tasks.reduce((acc, t) => acc + (t.tokensConsumed || 0), 0);
    const todayTokens = tasks
      .filter(t => new Date(t.createdAt).toDateString() === new Date().toDateString())
      .reduce((acc, t) => acc + (t.tokensConsumed || 0), 0);

    return { running, completed, pending, failed, totalTokens, todayTokens };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter(t => t.status === statusFilter);
  }, [tasks, statusFilter]);

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    {
      key: 'cmd+r',
      description: t('shortcuts.refresh', 'Refresh tasks'),
      action: () => refetch(),
      category: 'Navigation',
    },
    {
      key: 'cmd+f',
      description: t('shortcuts.filterAll', 'Show all tasks'),
      action: () => setStatusFilter('all'),
      category: 'Filters',
    },
    {
      key: 'cmd+1',
      description: t('shortcuts.filterRunning', 'Show running tasks'),
      action: () => setStatusFilter('running'),
      category: 'Filters',
    },
    {
      key: 'cmd+2',
      description: t('shortcuts.filterCompleted', 'Show completed tasks'),
      action: () => setStatusFilter('completed'),
      category: 'Filters',
    },
    {
      key: 'cmd+3',
      description: t('shortcuts.filterPending', 'Show pending tasks'),
      action: () => setStatusFilter('pending'),
      category: 'Filters',
    },
  ], [t, refetch]);

  const { showHelp, setShowHelp } = useKeyboardShortcuts(shortcuts);

  return (
    <PageTransition variant="fade">
      <DashboardPageLayout
        header={{
          title: t('tasks.title', 'Task Center'),
          description: t('tasks.description', 'Monitor and manage your automation tasks'),
          actions: (
            <GradientButton
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {t('tasks.refresh', 'Refresh')}
            </GradientButton>
          ),
        }}
      >
        <div className="space-y-6">
          {/* Token Overview Card */}
          <TokenOverviewCard
            currentBalance={0}
            todayConsumed={stats.todayTokens}
            monthlyConsumed={stats.totalTokens}
            pendingTasks={stats.pending}
            monthlyLimit={10000}
            loading={isLoading}
          />

          {/* Statistics Cards */}
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <SkeletonMetricCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title={t('tasks.stats.running', 'Running')}
                value={stats.running}
                subtitle={t('tasks.stats.inProgress', 'In progress')}
                icon={<Play className="h-6 w-6 text-blue-600" />}
                variant="primary"
              />
              <MetricCard
                title={t('tasks.stats.completed', 'Completed')}
                value={stats.completed}
                subtitle={t('tasks.stats.successful', 'Successful')}
                icon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
                variant="success"
              />
              <MetricCard
                title={t('tasks.stats.pending', 'Pending')}
                value={stats.pending}
                subtitle={t('tasks.stats.queued', 'Queued')}
                icon={<Clock className="h-6 w-6 text-yellow-600" />}
                variant="warning"
              />
              <MetricCard
                title={t('tasks.stats.failed', 'Failed')}
                value={stats.failed}
                subtitle={t('tasks.stats.needsAttention', 'Needs attention')}
                icon={<XCircle className="h-6 w-6 text-red-600" />}
                variant="error"
              />
            </div>
          )}

          {/* Filters */}
          <GlassCard>
            <GlassCardContent className="p-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('tasks.filterBy', 'Filter by status')}:</span>
                <div className="flex gap-2">
                  {['all', 'running', 'completed', 'pending', 'failed'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                        statusFilter === status
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {t(`tasks.status.${status}`, status)}
                    </button>
                  ))}
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Tasks Timeline */}
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center justify-between">
                <span>{t('tasks.timeline', 'Task Timeline')}</span>
                <Badge variant="secondary">
                  {filteredTasks.length} {t('tasks.items', 'items')}
                </Badge>
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              {!isLoading && filteredTasks.length === 0 ? (
                <EmptyDataState
                  title={t('tasks.noTasks', 'No tasks found')}
                  description={
                    statusFilter !== 'all'
                      ? t('tasks.noTasksFiltered', 'No tasks match the selected filter')
                      : t('tasks.noTasksDesc', 'Start by evaluating an offer to create your first task')
                  }
                  actionLabel={statusFilter !== 'all' ? t('tasks.clearFilter', 'Clear filter') : undefined}
                  onAction={statusFilter !== 'all' ? () => setStatusFilter('all') : undefined}
                />
              ) : (
                <TaskTimelineView
                  tasks={filteredTasks as any}
                  loading={isLoading}
                />
              )}
            </GlassCardContent>
          </GlassCard>

          {/* Task Types Info */}
          <div className="grid gap-6 sm:grid-cols-3">
            <GlassCard hover className="cursor-pointer">
              <GlassCardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                    <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{t('tasks.types.evaluation', 'Evaluation Tasks')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('tasks.types.evaluationDesc', 'AI-powered offer analysis')}
                    </p>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>

            <GlassCard hover className="cursor-pointer">
              <GlassCardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{t('tasks.types.monitoring', 'Performance Monitoring')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('tasks.types.monitoringDesc', 'Track campaign performance')}
                    </p>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>

            <GlassCard hover className="cursor-pointer">
              <GlassCardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                    <RefreshCw className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{t('tasks.types.sync', 'Data Sync')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('tasks.types.syncDesc', 'Synchronize ad accounts')}
                    </p>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>
          </div>
        </div>
      </DashboardPageLayout>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        shortcuts={shortcuts}
        open={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </PageTransition>
  );
}