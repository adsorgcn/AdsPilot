import { useTranslation } from 'react-i18next';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon, 
  PlayCircleIcon,
  BanIcon,
  ExternalLinkIcon
} from 'lucide-react';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import type { Task } from '~/lib/tasks/types';

interface TasksTableProps {
  tasks: Task[];
  isLoading?: boolean;
  onCancel?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
  onViewDetails?: (task: Task) => void;
}

export function TasksTable({ 
  tasks, 
  isLoading, 
  onCancel, 
  onRetry,
  onViewDetails 
}: TasksTableProps) {
  const { t } = useTranslation('common');

  const getStatusBadge = (status: Task['status']) => {
    const statusConfig = {
      'pending': { 
        color: 'info' as const, 
        icon: ClockIcon, 
        label: t('tasks.status.pending', 'Pending') 
      },
      'running': { 
        color: 'info' as const, 
        icon: PlayCircleIcon, 
        label: t('tasks.status.running', 'Running') 
      },
      'completed': { 
        color: 'success' as const, 
        icon: CheckCircleIcon, 
        label: t('tasks.status.completed', 'Completed') 
      },
      'failed': { 
        color: 'error' as const, 
        icon: XCircleIcon, 
        label: t('tasks.status.failed', 'Failed') 
      },
      'cancelled': { 
        color: 'normal' as const, 
        icon: BanIcon, 
        label: t('tasks.status.cancelled', 'Cancelled') 
      },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge color={config.color} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getTaskTypeLabel = (type: Task['type']) => {
    const typeLabels = {
      'evaluation': t('tasks.type.evaluation', 'Evaluation'),
      'click_task': t('tasks.type.clickTask', 'Click Task'),
      'deployment': t('tasks.type.deployment', 'Deployment'),
      'sync': t('tasks.type.sync', 'Sync'),
      'other': t('tasks.type.other', 'Other'),
    };
    return typeLabels[type] || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return '-';
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const duration = Math.floor((end - start) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border">
        <div className="p-6 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border">
        <div className="p-6 border-b">
          <h3 className="font-semibold">{t('tasks.ui.recentTasks', 'Recent Tasks')}</h3>
        </div>
        <div className="p-6 text-center text-muted-foreground">
          <p className="text-sm mb-4">{t('tasks.ui.noTasksFound', 'No tasks found')}</p>
          <p className="text-xs">{t('tasks.ui.createFirstTask', 'Create your first automation task to get started')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-semibold">{t('tasks.ui.recentTasks', 'Recent Tasks')}</h3>
      </div>
      
      {/* Desktop view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('tasks.table.type', 'Type')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('tasks.table.status', 'Status')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('tasks.table.progress', 'Progress')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('tasks.table.tokens', 'Tokens')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('tasks.table.duration', 'Duration')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('tasks.table.created', 'Created')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('tasks.table.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{getTaskTypeLabel(task.type)}</span>
                    {task.offerUrl && (
                      <a 
                        href={task.offerUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {task.currentStep && (
                    <div className="text-xs text-muted-foreground mt-1">{task.currentStep}</div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {getStatusBadge(task.status)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {task.progress !== undefined ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all" 
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{task.progress}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm">
                    {task.tokensConsumed > 0 ? task.tokensConsumed.toLocaleString() : '-'}
                  </div>
                  {task.estimatedTokens && (
                    <div className="text-xs text-muted-foreground">
                      / {task.estimatedTokens.toLocaleString()}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  {formatDuration(task.startedAt, task.completedAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(task.createdAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    {task.status === 'running' && onCancel && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCancel(task.id)}
                      >
                        {t('tasks.actions.cancel', 'Cancel')}
                      </Button>
                    )}
                    {task.status === 'failed' && onRetry && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRetry(task.id)}
                      >
                        {t('tasks.actions.retry', 'Retry')}
                      </Button>
                    )}
                    {onViewDetails && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onViewDetails(task)}
                      >
                        {t('tasks.actions.details', 'Details')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile view */}
      <div className="md:hidden divide-y">
        {tasks.map((task) => (
          <div key={task.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{getTaskTypeLabel(task.type)}</span>
                  {task.offerUrl && (
                    <a 
                      href={task.offerUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600"
                    >
                      <ExternalLinkIcon className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {task.currentStep && (
                  <div className="text-xs text-muted-foreground">{task.currentStep}</div>
                )}
              </div>
              {getStatusBadge(task.status)}
            </div>

            {task.progress !== undefined && (
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('tasks.table.progress', 'Progress')}</span>
                  <span>{task.progress}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all" 
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">{t('tasks.table.tokens', 'Tokens')}:</span>
                <span className="ml-1 font-medium">
                  {task.tokensConsumed > 0 ? task.tokensConsumed.toLocaleString() : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('tasks.table.duration', 'Duration')}:</span>
                <span className="ml-1 font-medium">
                  {formatDuration(task.startedAt, task.completedAt)}
                </span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {formatDate(task.createdAt)}
            </div>

            <div className="flex gap-2">
              {task.status === 'running' && onCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCancel(task.id)}
                  className="flex-1"
                >
                  {t('tasks.actions.cancel', 'Cancel')}
                </Button>
              )}
              {task.status === 'failed' && onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRetry(task.id)}
                  className="flex-1"
                >
                  {t('tasks.actions.retry', 'Retry')}
                </Button>
              )}
              {onViewDetails && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onViewDetails(task)}
                  className="flex-1"
                >
                  {t('tasks.actions.details', 'Details')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
