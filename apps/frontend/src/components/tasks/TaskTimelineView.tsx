'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Clock, Sparkles } from 'lucide-react';
import { GlassCard } from '~/components/ui/GlassCard';
import Badge from '~/core/ui/Badge';
import { cn } from '~/core/generic/shadcn-utils';

export interface Task {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  tokensConsumed: number;
  createdAt: string;
  completedAt?: string;
  duration?: string;
  brandName?: string;
  domain?: string;
}

export interface TaskTimelineViewProps {
  tasks: Task[];
  loading?: boolean;
  className?: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-300 dark:border-gray-700',
    label: 'Pending',
  },
  running: {
    icon: Loader2,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-300 dark:border-blue-700',
    label: 'Running',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-300 dark:border-green-700',
    label: 'Completed',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-300 dark:border-red-700',
    label: 'Failed',
  },
};

export function TaskTimelineView({ tasks, loading = false, className }: TaskTimelineViewProps) {
  const { t } = useTranslation('common');

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              {i < 3 && <div className="h-20 w-0.5 animate-pulse bg-muted" />}
            </div>
            <div className="flex-1 pb-8">
              <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <Sparkles className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground">
          {t('tasks.timeline.empty', 'No tasks yet. Start by evaluating an offer!')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {tasks.map((task, index) => {
        const config = statusConfig[task.status];
        const Icon = config.icon;
        const isLast = index === tasks.length - 1;

        return (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex gap-4"
          >
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2',
                  config.bgColor,
                  config.borderColor
                )}
              >
                <Icon
                  className={cn('h-5 w-5', config.color, task.status === 'running' && 'animate-spin')}
                />
              </div>
              {!isLast && (
                <div className={cn('h-full w-0.5 my-2', config.bgColor)} />
              )}
            </div>

            {/* Task card */}
            <div className={cn('flex-1', !isLast && 'pb-6')}>
              <GlassCard
                variant="default"
                hover
                className={cn('border-l-4', config.borderColor)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{task.type}</h4>
                        <Badge variant={task.status === 'completed' ? 'default' : task.status === 'failed' ? 'destructive' : 'default'}>
                          {config.label}
                        </Badge>
                      </div>
                      {(task.brandName || task.domain) && (
                        <p className="text-sm text-muted-foreground">
                          {task.brandName || task.domain}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{task.tokensConsumed} tokens</div>
                      {task.duration && (
                        <div className="text-xs text-muted-foreground">{task.duration}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(task.createdAt).toLocaleString()}</span>
                    </div>
                    {task.completedAt && (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{new Date(task.completedAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar for running tasks */}
                  {task.status === 'running' && (
                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
                          initial={{ width: '0%' }}
                          animate={{ width: '70%' }}
                          transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}