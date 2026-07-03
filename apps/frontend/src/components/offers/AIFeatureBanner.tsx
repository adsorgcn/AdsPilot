'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Sparkles, Zap, TrendingUp, ArrowRight, Crown } from 'lucide-react';
import { GlassCard } from '~/components/ui/GlassCard';
import { GradientButton } from '~/components/ui/GradientButton';
import { GradientText } from '~/components/ui/GradientText';
import Badge from '~/core/ui/Badge';
import { cn } from '~/core/generic/shadcn-utils';

export interface AIFeatureBannerProps {
  /**
   * Current token balance
   */
  tokenBalance: number;
  /**
   * User's subscription tier
   */
  subscriptionTier: 'trial' | 'pro' | 'max' | 'elite';
  /**
   * Whether user can use AI features
   */
  canUseAI: boolean;
  /**
   * Number of selected offers
   */
  selectedCount?: number;
  /**
   * Callback when evaluate button is clicked
   */
  onEvaluate?: () => void;
  /**
   * Callback when upgrade button is clicked
   */
  onUpgrade?: () => void;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const tierConfig = {
  trial: {
    label: 'Trial',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: Sparkles,
  },
  pro: {
    label: 'Pro',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: Zap,
  },
  max: {
    label: 'Max',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    icon: TrendingUp,
  },
  elite: {
    label: 'Elite',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    icon: Crown,
  },
};

/**
 * AIFeatureBanner - Prominent banner to promote AI evaluation features
 * 
 * Displays token balance, subscription tier, and quick access to AI evaluation.
 * Encourages trial users to upgrade for AI features.
 */
export function AIFeatureBanner({
  tokenBalance,
  subscriptionTier,
  canUseAI,
  selectedCount = 0,
  onEvaluate,
  onUpgrade,
  className,
}: AIFeatureBannerProps) {
  const { t } = useTranslation('common');
  const config = tierConfig[subscriptionTier];
  const TierIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      <GlassCard 
        variant="gradient" 
        className={cn(
          'relative overflow-hidden',
          'bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10'
        )}
      >
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
        
        <div className="relative p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Left section - AI Features Info */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <GradientText variant="primary" size="xl" as="h3" className="font-bold">
                    {t('offers.aiBanner.title', 'AI-Powered Evaluation')}
                  </GradientText>
                  <p className="text-sm text-muted-foreground">
                    {canUseAI
                      ? t('offers.aiBanner.subtitle', 'Get instant insights on offer quality and performance')
                      : t('offers.aiBanner.upgradeSubtitle', 'Upgrade to unlock AI evaluation features')}
                  </p>
                </div>
              </div>

              {/* Token Balance & Tier */}
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className={cn('flex items-center gap-1.5', config.bgColor, config.color)}>
                  <TierIcon className="h-3.5 w-3.5" />
                  {config.label}
                </Badge>
                
                {canUseAI && (
                  <div className="flex items-center gap-2 rounded-lg bg-white/50 dark:bg-gray-800/50 px-3 py-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold">
                      {tokenBalance.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('offers.aiBanner.tokens', 'tokens')}
                    </span>
                  </div>
                )}

                {selectedCount > 0 && canUseAI && (
                  <Badge variant="default" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {t('offers.aiBanner.selected', '{{count}} selected', { count: selectedCount })}
                  </Badge>
                )}
              </div>
            </div>

            {/* Right section - Actions */}
            <div className="flex items-center gap-3">
              {canUseAI ? (
                <GradientButton
                  variant="primary"
                  size="lg"
                  onClick={onEvaluate}
                  disabled={selectedCount === 0}
                  className="group"
                >
                  <Sparkles className="h-4 w-4" />
                  {selectedCount > 0
                    ? t('offers.aiBanner.evaluateSelected', 'Evaluate {{count}}', { count: selectedCount })
                    : t('offers.aiBanner.evaluate', 'Evaluate Offers')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </GradientButton>
              ) : (
                <GradientButton
                  variant="primary"
                  size="lg"
                  onClick={onUpgrade}
                  className="group bg-gradient-to-r from-purple-500 to-pink-500"
                >
                  <Crown className="h-4 w-4" />
                  {t('offers.aiBanner.upgrade', 'Upgrade to Pro')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </GradientButton>
              )}
            </div>
          </div>

          {/* Feature highlights for trial users */}
          {!canUseAI && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ delay: 0.2 }}
              className="mt-4 pt-4 border-t border-border/50"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                    <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {t('offers.aiBanner.features.quality', 'Quality Score')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('offers.aiBanner.features.qualityDesc', 'AI-powered quality analysis')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
                    <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {t('offers.aiBanner.features.insights', 'Smart Insights')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('offers.aiBanner.features.insightsDesc', 'Actionable recommendations')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900">
                    <Zap className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {t('offers.aiBanner.features.batch', 'Batch Processing')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('offers.aiBanner.features.batchDesc', 'Evaluate multiple offers')}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}