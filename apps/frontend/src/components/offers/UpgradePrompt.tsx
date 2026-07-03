'use client';

import { useTranslation } from 'react-i18next';
import { Sparkles, Zap, Crown, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/core/ui/Card';

interface UpgradePromptProps {
  variant?: 'inline' | 'card';
  feature?: 'ai-evaluation' | 'unlimited-offers' | 'premium-features';
  className?: string;
}

/**
 * FE-025: UpgradePrompt component for Starter plan users
 * Displays upgrade prompts for various premium features
 */
export function UpgradePrompt({ variant = 'inline', feature = 'ai-evaluation', className }: UpgradePromptProps) {
  const { t } = useTranslation('common');

  const featureConfig = {
    'ai-evaluation': {
      icon: <Sparkles className="h-5 w-5" />,
      title: t('upgrade.aiEvaluation.title', 'Unlock AI-Powered Evaluation'),
      description: t(
        'upgrade.aiEvaluation.description',
        'Get intelligent recommendations, competitor analysis, and detailed insights powered by advanced AI.'
      ),
      benefits: [
        t('upgrade.aiEvaluation.benefit1', 'AI-powered traffic analysis'),
        t('upgrade.aiEvaluation.benefit2', 'Competitor landscape insights'),
        t('upgrade.aiEvaluation.benefit3', 'Budget recommendations'),
        t('upgrade.aiEvaluation.benefit4', 'Seasonal timing analysis'),
      ],
    },
    'unlimited-offers': {
      icon: <Zap className="h-5 w-5" />,
      title: t('upgrade.unlimitedOffers.title', 'Unlimited Offers'),
      description: t(
        'upgrade.unlimitedOffers.description',
        'Scale your affiliate business without limits. Manage unlimited offers and campaigns.'
      ),
      benefits: [
        t('upgrade.unlimitedOffers.benefit1', 'No offer limits'),
        t('upgrade.unlimitedOffers.benefit2', 'Advanced filtering & search'),
        t('upgrade.unlimitedOffers.benefit3', 'Bulk operations'),
        t('upgrade.unlimitedOffers.benefit4', 'Priority support'),
      ],
    },
    'premium-features': {
      icon: <Crown className="h-5 w-5" />,
      title: t('upgrade.premiumFeatures.title', 'Unlock All Premium Features'),
      description: t(
        'upgrade.premiumFeatures.description',
        'Access the full power of Google-Monetize with Professional or Elite plans.'
      ),
      benefits: [
        t('upgrade.premiumFeatures.benefit1', 'AI-powered insights'),
        t('upgrade.premiumFeatures.benefit2', 'Advanced analytics'),
        t('upgrade.premiumFeatures.benefit3', 'API access'),
        t('upgrade.premiumFeatures.benefit4', 'Custom integrations'),
      ],
    },
  };

  const config = featureConfig[feature];

  if (variant === 'inline') {
    return (
      <Alert className={className}>
        <div className="flex items-center gap-2">
          {config.icon}
          <AlertTitle className="mb-0">{config.title}</AlertTitle>
        </div>
        <AlertDescription className="mt-2">
          <div className="flex items-center justify-between gap-4">
            <span>{config.description}</span>
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                window.location.href = '/settings/subscription';
              }}
              className="shrink-0 gap-1"
            >
              {t('upgrade.viewPlans', 'View Plans')}
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Card variant - more detailed
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">{config.icon}</div>
          <div>
            <CardTitle className="text-xl">{config.title}</CardTitle>
            <CardDescription>{config.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Benefits list */}
        <ul className="space-y-2">
          {config.benefits.map((benefit, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {/* Pricing comparison */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t">
          <div className="space-y-1">
            <div className="text-sm font-medium">{t('upgrade.professional', 'Professional')}</div>
            <div className="text-2xl font-bold">$29</div>
            <div className="text-xs text-muted-foreground">{t('upgrade.perMonth', 'per month')}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium flex items-center gap-1">
              <Crown className="h-3 w-3" />
              {t('upgrade.elite', 'Elite')}
            </div>
            <div className="text-2xl font-bold">$99</div>
            <div className="text-xs text-muted-foreground">{t('upgrade.perMonth', 'per month')}</div>
          </div>
        </div>

        {/* CTA */}
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={() => {
            window.location.href = '/settings/subscription';
          }}
        >
          {t('upgrade.upgradePlans', 'Compare Plans & Upgrade')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
