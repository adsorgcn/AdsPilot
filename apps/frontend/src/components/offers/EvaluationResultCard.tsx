'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TrendingUp, Globe, Users, BarChart3, Sparkles } from 'lucide-react';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '~/components/ui/GlassCard';
import { GradientText } from '~/components/ui/GradientText';
import { RadarChart } from '~/components/charts/RadarChart';
import Badge from '~/core/ui/Badge';
import { cn } from '~/core/generic/shadcn-utils';

interface EvaluationMetrics {
  traffic: number;
  engagement: number;
  authority: number;
  conversion: number;
}

export interface EvaluationResultCardProps {
  overallScore: number;
  metrics: EvaluationMetrics;
  recommendation: string;
  insights: string[];
  brandName?: string;
  className?: string;
}

const metricIcons = {
  traffic: Globe,
  engagement: Users,
  authority: TrendingUp,
  conversion: BarChart3,
};

const metricLabels = {
  traffic: 'Traffic',
  engagement: 'Engagement',
  authority: 'Authority',
  conversion: 'Conversion',
};

export function EvaluationResultCard({
  overallScore,
  metrics,
  recommendation,
  insights,
  brandName,
  className,
}: EvaluationResultCardProps) {
  const { t } = useTranslation('common');

  // Prepare radar chart data
  const radarData = Object.entries(metrics).map(([key, value]) => ({
    subject: metricLabels[key as keyof EvaluationMetrics],
    value: value,
    fullMark: 10,
  }));

  // Determine score color
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400';
    if (score >= 6) return 'text-blue-600 dark:text-blue-400';
    if (score >= 4) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreVariant = (score: number): 'default' | 'destructive' => {
    if (score >= 4) return 'default';
    return 'destructive';
  };
  
  const getScoreBgColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    if (score >= 6) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    if (score >= 4) return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
    return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <GlassCard variant="gradient" className="overflow-hidden">
        {/* Header with Score */}
        <GlassCardHeader className="bg-gradient-to-br from-blue-500/10 to-purple-500/10">
          <div className="flex items-center justify-between">
            <div>
              <GlassCardTitle>
                <GradientText variant="primary" size="xl">
                  {t('offers.evaluation.result', 'Evaluation Result')}
                </GradientText>
              </GlassCardTitle>
              {brandName && (
                <p className="text-sm text-muted-foreground mt-1">{brandName}</p>
              )}
            </div>
            <div className="text-center">
              <div className={cn('text-5xl font-bold', getScoreColor(overallScore))}>
                {overallScore.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {t('offers.evaluation.overallScore', 'Overall Score')}
              </div>
            </div>
          </div>
        </GlassCardHeader>

        <GlassCardContent className="space-y-6">
          {/* Radar Chart */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              {t('offers.evaluation.metrics', 'Performance Metrics')}
            </h3>
            <RadarChart
              data={radarData}
              height={250}
              color="hsl(217, 91%, 60%)"
            />
          </div>

          {/* Metric Details */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(metrics).map(([key, value]) => {
              const Icon = metricIcons[key as keyof EvaluationMetrics];
              const label = metricLabels[key as keyof EvaluationMetrics];
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                    <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-lg font-bold">{value.toFixed(1)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendation */}
          <div className="rounded-lg border border-border/50 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 p-4">
            <div className="flex items-start gap-2">
              <Badge variant={getScoreVariant(overallScore)} className={cn("mt-0.5", getScoreBgColor(overallScore))}>
                {t('offers.evaluation.recommendation', 'Recommendation')}
              </Badge>
              <p className="text-sm flex-1">{recommendation}</p>
            </div>
          </div>

          {/* Insights */}
          {insights && insights.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                {t('offers.evaluation.insights', 'Key Insights')}
              </h3>
              <ul className="space-y-2">
                {insights.map((insight, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                    <span>{insight}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}