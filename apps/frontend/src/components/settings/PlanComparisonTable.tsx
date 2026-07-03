'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, X, Crown, Zap, Rocket, Star } from 'lucide-react';
import { GlassCard } from '~/components/ui/GlassCard';
import { GradientButton } from '~/components/ui/GradientButton';
import { GradientText } from '~/components/ui/GradientText';
import Badge from '~/core/ui/Badge';
import { cn } from '~/core/generic/shadcn-utils';

export type PlanTier = 'trial' | 'pro' | 'max' | 'elite';

export interface PlanFeature {
  name: string;
  trial: boolean | string;
  pro: boolean | string;
  max: boolean | string;
  elite: boolean | string;
}

export interface PlanComparisonTableProps {
  /**
   * Current user's plan
   */
  currentPlan: PlanTier;
  /**
   * Callback when upgrade button is clicked
   */
  onUpgrade?: (plan: PlanTier) => void;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const planConfig = {
  trial: {
    name: 'Trial',
    price: 0,
    period: 'forever',
    icon: Star,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    gradient: 'from-gray-400 to-gray-600',
    description: 'Get started with basic features',
    popular: false,
  },
  pro: {
    name: 'Pro',
    price: 29,
    period: 'month',
    icon: Zap,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    gradient: 'from-blue-500 to-blue-700',
    description: 'Perfect for growing businesses',
    popular: true,
  },
  max: {
    name: 'Max',
    price: 99,
    period: 'month',
    icon: Rocket,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    gradient: 'from-purple-500 to-purple-700',
    description: 'Advanced features for power users',
    popular: false,
  },
  elite: {
    name: 'Elite',
    price: 299,
    period: 'month',
    icon: Crown,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    gradient: 'from-amber-500 to-amber-700',
    description: 'Enterprise-grade solution',
    popular: false,
  },
};

/**
 * PlanComparisonTable - Feature comparison table for subscription plans
 * 
 * Displays a side-by-side comparison of all available plans with their
 * features, pricing, and upgrade options.
 */
export function PlanComparisonTable({
  currentPlan,
  onUpgrade,
  className,
}: PlanComparisonTableProps) {
  const { t } = useTranslation('common');

  const features: PlanFeature[] = [
    {
      name: t('settings.plans.features.offers', 'Offers'),
      trial: '10',
      pro: '100',
      max: '500',
      elite: t('settings.plans.unlimited', 'Unlimited'),
    },
    {
      name: t('settings.plans.features.aiEvaluations', 'AI Evaluations'),
      trial: false,
      pro: true,
      max: true,
      elite: true,
    },
    {
      name: t('settings.plans.features.tokens', 'Monthly Tokens'),
      trial: '0',
      pro: '10,000',
      max: '50,000',
      elite: '200,000',
    },
    {
      name: t('settings.plans.features.adAccounts', 'Ad Accounts'),
      trial: '1',
      pro: '3',
      max: '10',
      elite: t('settings.plans.unlimited', 'Unlimited'),
    },
    {
      name: t('settings.plans.features.performanceMonitoring', 'Performance Monitoring'),
      trial: false,
      pro: true,
      max: true,
      elite: true,
    },
    {
      name: t('settings.plans.features.batchProcessing', 'Batch Processing'),
      trial: false,
      pro: '10 offers',
      max: '50 offers',
      elite: t('settings.plans.unlimited', 'Unlimited'),
    },
    {
      name: t('settings.plans.features.apiAccess', 'API Access'),
      trial: false,
      pro: false,
      max: true,
      elite: true,
    },
    {
      name: t('settings.plans.features.prioritySupport', 'Priority Support'),
      trial: false,
      pro: false,
      max: true,
      elite: true,
    },
    {
      name: t('settings.plans.features.customIntegrations', 'Custom Integrations'),
      trial: false,
      pro: false,
      max: false,
      elite: true,
    },
    {
      name: t('settings.plans.features.dedicatedManager', 'Dedicated Account Manager'),
      trial: false,
      pro: false,
      max: false,
      elite: true,
    },
  ];

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-5 w-5 text-green-600" />
      ) : (
        <X className="h-5 w-5 text-gray-300" />
      );
    }
    return <span className="text-sm font-medium">{value}</span>;
  };

  const plans: PlanTier[] = ['trial', 'pro', 'max', 'elite'];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Mobile view - Cards */}
      <div className="grid gap-6 md:hidden">
        {plans.map((plan, index) => {
          const config = planConfig[plan];
          const Icon = config.icon;
          const isCurrent = currentPlan === plan;

          return (
            <motion.div
              key={plan}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard 
                variant={config.popular ? 'gradient' : 'default'}
                className={cn(
                  'relative overflow-hidden',
                  isCurrent && 'ring-2 ring-primary'
                )}
              >
                {config.popular && (
                  <div className="absolute top-0 right-0">
                    <Badge variant="default" className="rounded-bl-lg rounded-tr-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                      {t('settings.plans.popular', 'Popular')}
                    </Badge>
                  </div>
                )}

                <div className="p-6 space-y-4">
                  {/* Header */}
                  <div className="text-center">
                    <div className={cn(
                      'inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-3',
                      'bg-gradient-to-br shadow-lg',
                      config.gradient
                    )}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <GradientText variant="primary" size="2xl" as="h3" className="font-bold">
                      {config.name}
                    </GradientText>
                    <p className="text-sm text-muted-foreground mt-1">
                      {config.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="text-center py-4 border-y border-border/50">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold">${config.price}</span>
                      <span className="text-muted-foreground">/{config.period}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-3">
                    {features.map((feature) => (
                      <div key={feature.name} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{feature.name}</span>
                        {renderFeatureValue(feature[plan])}
                      </div>
                    ))}
                  </div>

                  {/* Action */}
                  <div className="pt-4">
                    {isCurrent ? (
                      <Badge variant="default" className="w-full justify-center py-2">
                        {t('settings.plans.currentPlan', 'Current Plan')}
                      </Badge>
                    ) : (
                      <GradientButton
                        variant={config.popular ? 'primary' : 'outline'}
                        className="w-full"
                        onClick={() => onUpgrade?.(plan)}
                      >
                        {t('settings.plans.upgrade', 'Upgrade to {{plan}}', { plan: config.name })}
                      </GradientButton>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* Desktop view - Table */}
      <div className="hidden md:block">
        <GlassCard variant="gradient">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="p-4 text-left">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {t('settings.plans.features.title', 'Features')}
                    </span>
                  </th>
                  {plans.map((plan) => {
                    const config = planConfig[plan];
                    const Icon = config.icon;
                    const isCurrent = currentPlan === plan;

                    return (
                      <th key={plan} className="p-4 text-center relative">
                        {config.popular && (
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                            <Badge variant="default" className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                              {t('settings.plans.popular', 'Popular')}
                            </Badge>
                          </div>
                        )}
                        <div className="space-y-2">
                          <div className={cn(
                            'inline-flex h-12 w-12 items-center justify-center rounded-xl',
                            'bg-gradient-to-br shadow-md',
                            config.gradient
                          )}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-lg">{config.name}</p>
                            <p className="text-sm text-muted-foreground">{config.description}</p>
                          </div>
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-2xl font-bold">${config.price}</span>
                            <span className="text-xs text-muted-foreground">/{config.period}</span>
                          </div>
                          {isCurrent ? (
                            <Badge variant="default" className="mt-2">
                              {t('settings.plans.currentPlan', 'Current')}
                            </Badge>
                          ) : (
                            <GradientButton
                              variant={config.popular ? 'primary' : 'outline'}
                              size="sm"
                              className="mt-2"
                              onClick={() => onUpgrade?.(plan)}
                            >
                              {t('settings.plans.upgrade', 'Upgrade')}
                            </GradientButton>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <motion.tr
                    key={feature.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4 text-sm font-medium">{feature.name}</td>
                    {plans.map((plan) => (
                      <td key={plan} className="p-4 text-center">
                        {renderFeatureValue(feature[plan])}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}