'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown,
  ChevronUp,
  Eye,
  MousePointerClick,
  TrendingUp,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '~/components/ui/GlassCard';
import { Sparkline } from '~/components/ui/Sparkline';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import type { PlatformType } from './PlatformConnectionCard';

export interface PerformanceMetrics {
  impressions: number;
  clicks: number;
  ctr: number; // Click-through rate (percentage)
  cpc: number; // Cost per click
  spend: number;
  conversions?: number;
}

export interface AccountPerformanceCardProps {
  /**
   * Platform type
   */
  platform: PlatformType;
  /**
   * Account name
   */
  accountName: string;
  /**
   * Account ID
   */
  accountId: string;
  /**
   * Performance metrics
   */
  metrics: PerformanceMetrics;
  /**
   * Sparkline data for impressions trend
   */
  impressionsTrend?: number[];
  /**
   * Sparkline data for clicks trend
   */
  clicksTrend?: number[];
  /**
   * Whether the card is initially expanded
   */
  defaultExpanded?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const platformColors: Record<PlatformType, string> = {
  google: 'text-blue-600',
  meta: 'text-blue-500',
  tiktok: 'text-pink-600',
  twitter: 'text-sky-500',
  linkedin: 'text-blue-700',
};

/**
 * AccountPerformanceCard - Expandable card showing ad account performance
 * 
 * Displays key metrics (impressions, clicks, CTR, CPC) with sparkline trends.
 * Can be expanded/collapsed to show/hide detailed metrics.
 */
export function AccountPerformanceCard({
  platform,
  accountName,
  accountId,
  metrics,
  impressionsTrend,
  clicksTrend,
  defaultExpanded = false,
  className,
}: AccountPerformanceCardProps) {
  const { t } = useTranslation('common');
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <GlassCard variant="default" className="overflow-hidden">
        <GlassCardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <GlassCardTitle className="flex items-center gap-2">
                <span className={platformColors[platform]}>{accountName}</span>
                <Badge variant="secondary" className="text-xs">
                  {accountId}
                </Badge>
              </GlassCardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span className="sr-only">
                {isExpanded 
                  ? t('adscenter.performance.collapse', 'Collapse') 
                  : t('adscenter.performance.expand', 'Expand')}
              </span>
            </Button>
          </div>
        </GlassCardHeader>

        <GlassCardContent>
          {/* Summary metrics - always visible */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" />
                  {t('adscenter.metrics.impressions', 'Impressions')}
                </div>
                {impressionsTrend && impressionsTrend.length > 0 && (
                  <Sparkline
                    data={impressionsTrend}
                    width={40}
                    height={16}
                    color="hsl(217, 91%, 60%)"
                    showArea={false}
                  />
                )}
              </div>
              <p className="text-lg font-bold">{formatNumber(metrics.impressions)}</p>
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  {t('adscenter.metrics.clicks', 'Clicks')}
                </div>
                {clicksTrend && clicksTrend.length > 0 && (
                  <Sparkline
                    data={clicksTrend}
                    width={40}
                    height={16}
                    color="hsl(260, 91%, 65%)"
                    showArea={false}
                  />
                )}
              </div>
              <p className="text-lg font-bold">{formatNumber(metrics.clicks)}</p>
            </div>
          </div>

          {/* Detailed metrics - shown when expanded */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
                  {/* CTR */}
                  <div className="rounded-lg bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {t('adscenter.metrics.ctr', 'CTR')}
                    </div>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatPercentage(metrics.ctr)}
                    </p>
                  </div>

                  {/* CPC */}
                  <div className="rounded-lg bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      {t('adscenter.metrics.cpc', 'CPC')}
                    </div>
                    <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(metrics.cpc)}
                    </p>
                  </div>

                  {/* Total Spend */}
                  <div className="rounded-lg bg-gradient-to-br from-orange-50/50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      {t('adscenter.metrics.spend', 'Total Spend')}
                    </div>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(metrics.spend)}
                    </p>
                  </div>

                  {/* Conversions (if available) */}
                  {metrics.conversions !== undefined && (
                    <div className="rounded-lg bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 p-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        {t('adscenter.metrics.conversions', 'Conversions')}
                      </div>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatNumber(metrics.conversions)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Performance insights */}
                <div className="mt-3 rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    {metrics.ctr >= 2 
                      ? t('adscenter.insights.goodCtr', '✨ Great CTR! Your ads are performing well.')
                      : metrics.ctr >= 1
                      ? t('adscenter.insights.averageCtr', '📊 Average CTR. Consider optimizing ad copy.')
                      : t('adscenter.insights.lowCtr', '⚠️ Low CTR. Review targeting and creative.')}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}