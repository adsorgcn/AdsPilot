'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, ArrowRight } from 'lucide-react';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '~/components/ui/GlassCard';
import { GradientText } from '~/components/ui/GradientText';
import Badge from '~/core/ui/Badge';
import { cn } from '~/core/generic/shadcn-utils';

interface AIInsight {
  id: string;
  type: 'recommendation' | 'warning' | 'opportunity';
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  priority?: 'high' | 'medium' | 'low';
}

interface AIInsightsCardProps {
  insights?: AIInsight[];
  loading?: boolean;
  className?: string;
}

const insightConfig = {
  recommendation: {
    icon: Lightbulb,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
    badge: 'primary',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/10',
    badge: 'warning',
  },
  opportunity: {
    icon: TrendingUp,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10',
    badge: 'success',
  },
};

export function AIInsightsCard({ insights = [], loading = false, className }: AIInsightsCardProps) {
  const { t } = useTranslation('common');

  if (loading) {
    return (
      <GlassCard variant="gradient" className={className}>
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 animate-pulse" />
            <GlassCardTitle>
              {t('dashboard.aiInsights.title', 'AI Insights')}
            </GlassCardTitle>
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-3/4 bg-muted rounded mb-2" />
                <div className="h-3 w-full bg-muted rounded" />
              </div>
            ))}
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  if (insights.length === 0) {
    return (
      <GlassCard variant="gradient" className={className}>
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <GlassCardTitle>
              {t('dashboard.aiInsights.title', 'AI Insights')}
            </GlassCardTitle>
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              {t('dashboard.aiInsights.empty', 'No insights available yet. Add offers to get AI-powered recommendations.')}
            </p>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="gradient" className={className}>
      <GlassCardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <GlassCardTitle>
              <GradientText variant="primary">
                {t('dashboard.aiInsights.title', 'AI Insights')}
              </GradientText>
            </GlassCardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {insights.length} {t('dashboard.aiInsights.new', 'new')}
          </Badge>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-4">
          {insights.map((insight) => {
            const config = insightConfig[insight.type];
            const Icon = config.icon;

            return (
              <div
                key={insight.id}
                className={cn(
                  'p-4 rounded-lg border border-border/50 transition-all duration-200',
                  'hover:border-border hover:shadow-md',
                  config.bgColor
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-full', config.bgColor)}>
                    <Icon className={cn('h-4 w-4', config.color)} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold">{insight.title}</h4>
                      {insight.priority === 'high' && (
                        <Badge variant="destructive" className="text-xs">
                          {t('dashboard.aiInsights.highPriority', 'High')}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-2">
                      {insight.description}
                    </p>
                    
                    {insight.action && (
                      <button
                        onClick={insight.action.onClick}
                        className={cn(
                          'inline-flex items-center gap-1 text-xs font-medium',
                          config.color,
                          'hover:underline transition-colors'
                        )}
                      >
                        {insight.action.label}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}