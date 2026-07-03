'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, TrendingDown, Calendar, Clock } from 'lucide-react';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '~/components/ui/GlassCard';
import { ProgressRing } from '~/components/ui/ProgressRing';
import { GradientText } from '~/components/ui/GradientText';
import { cn } from '~/core/generic/shadcn-utils';

export interface TokenOverviewCardProps {
  currentBalance: number;
  todayConsumed: number;
  monthlyConsumed: number;
  pendingTasks: number;
  monthlyLimit?: number;
  className?: string;
  loading?: boolean;
}

export function TokenOverviewCard({
  currentBalance,
  todayConsumed,
  monthlyConsumed,
  pendingTasks,
  monthlyLimit = 10000,
  className,
  loading = false,
}: TokenOverviewCardProps) {
  const { t } = useTranslation('common');

  const usagePercentage = (monthlyConsumed / monthlyLimit) * 100;

  const stats = [
    {
      label: t('tasks.tokens.currentBalance', 'Current Balance'),
      value: currentBalance.toLocaleString(),
      icon: Coins,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: t('tasks.tokens.todayConsumed', 'Today Consumed'),
      value: todayConsumed.toLocaleString(),
      icon: TrendingDown,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: t('tasks.tokens.monthlyConsumed', 'Monthly Consumed'),
      value: monthlyConsumed.toLocaleString(),
      icon: Calendar,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: t('tasks.tokens.pendingTasks', 'Pending Tasks'),
      value: pendingTasks.toString(),
      icon: Clock,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500/10',
    },
  ];

  if (loading) {
    return (
      <GlassCard variant="gradient" className={className}>
        <GlassCardContent className="p-6">
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="gradient" className={className}>
      <GlassCardHeader>
        <div className="flex items-center justify-between">
          <GlassCardTitle>
            <GradientText variant="primary" size="lg">
              {t('tasks.tokens.overview', 'Token Overview')}
            </GradientText>
          </GlassCardTitle>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                {t('tasks.tokens.monthlyUsage', 'Monthly Usage')}
              </div>
              <div className="text-sm font-semibold">
                {monthlyConsumed.toLocaleString()} / {monthlyLimit.toLocaleString()}
              </div>
            </div>
            <ProgressRing
              value={monthlyConsumed}
              max={monthlyLimit}
              size="sm"
              color={usagePercentage > 80 ? 'error' : usagePercentage > 60 ? 'warning' : 'primary'}
            />
          </div>
        </div>
      </GlassCardHeader>

      <GlassCardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className={cn(
                  'relative overflow-hidden rounded-xl border border-border/50 p-4',
                  'bg-gradient-to-br from-white/50 to-white/30 dark:from-slate-900/50 dark:to-slate-800/30',
                  'backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-lg'
                )}
              >
                {/* Background decoration */}
                <div className={cn('absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-20', stat.bgColor)} />
                
                {/* Content */}
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', stat.bgColor)}>
                      <Icon className={cn('h-4 w-4', stat.color)} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}