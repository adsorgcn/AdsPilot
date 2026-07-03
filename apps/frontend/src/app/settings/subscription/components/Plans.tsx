'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Tile from '~/core/ui/Tile';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import {
  useBillingTokenBalance,
  useTokenUsageSummary,
  useUserSubscription,
} from '~/lib/billing';

const RANGE_DAYS = 30;

const Plans: React.FC = () => {
  const { t } = useTranslation('subscription');

  const { data: subscription } = useUserSubscription();
  const { data: balance } = useBillingTokenBalance();

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (RANGE_DAYS - 1));

  const { data: usage } = useTokenUsageSummary({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  const translatedPlans = useMemo(() => {
    return Object.fromEntries(
      Object.entries(PlansCatalog).map(([code, plan]) => [
        code,
        {
          ...plan,
          label: t(`catalog.${code}.label`, { defaultValue: plan.label }),
          description: t(`catalog.${code}.description`, {
            defaultValue: plan.description,
          }),
        },
      ]),
    ) as Record<
      keyof typeof PlansCatalog,
      (typeof PlansCatalog)[keyof typeof PlansCatalog] & {
        label: string;
        description: string;
      }
    >;
  }, [t]);

  const planMatrix = useMemo(
    () => Object.values(translatedPlans),
    [translatedPlans],
  );

  return (
    <div className="flex flex-col space-y-6">
      {/* Current Subscription Status */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" data-testid="subscription-summary">
        <Tile className="flex-1 min-w-[240px]" data-testid="subscription-current-plan-tile">
          <Tile.Heading>{t('subscriptionCurrentPlanHeading')}</Tile.Heading>
          <Tile.Body>
            <Tile.Figure data-testid="subscription-plan-name">
              {subscription?.planName ?? t('subscriptionCurrentPlanEmpty')}
            </Tile.Figure>
            <span data-testid="subscription-plan-status">
              {t('subscriptionCurrentPlanStatus', {
                status: subscription?.status ?? 'trial',
              })}
            </span>
          </Tile.Body>
        </Tile>
        <Tile className="flex-1 min-w-[240px]" data-testid="subscription-usage-tile">
          <Tile.Heading>{t('subscriptionUsageHeading')}</Tile.Heading>
          <Tile.Body>
            <Tile.Figure data-testid="subscription-usage-tokens">{usage?.totalConsumed?.toLocaleString() ?? '0'}</Tile.Figure>
            <span data-testid="subscription-balance">
              {t('subscriptionUsageTokens', {
                tokens: (balance?.totalBalance ?? balance?.currentBalance ?? 0).toLocaleString(),
              })}
            </span>
          </Tile.Body>
        </Tile>
      </div>

      {subscription?.status === 'pending' ? (
        <div className="rounded-lg border border-amber-400/50 bg-amber-50 p-4 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-200" data-testid="subscription-pending-alert">
          <p className="font-semibold">{t('subscriptionPendingTitle', 'Pending subscription')}</p>
          <p className="mt-1">{t('subscriptionPendingDesc', 'We detected an in-progress checkout. Complete payment to activate the plan.')}</p>
        </div>
      ) : null}

      {/* Available Plans */}
      <Section>
        <SectionHeader
          title={t('subscriptionAvailablePlansTitle', 'Available plans')}
          description={t('subscriptionAvailablePlansDesc', 'Choose a plan that fits your needs. Upgrade or downgrade anytime.')}
        />

        <SectionBody>
          <div className="grid gap-6 md:grid-cols-3">
            {planMatrix.map((plan) => (
              <Tile key={plan.code} className="relative space-y-4">
                {plan.recommended && (
                  <Badge className="absolute -top-3 right-4" color="success" size="small">
                    {t('subscriptionRecommendedBadge', 'Recommended')}
                  </Badge>
                )}

                <div>
                  <Tile.Heading>{plan.label}</Tile.Heading>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{t('subscriptionPlanPrice', { price: plan.basePrice })}</span>
                  <span className="text-sm text-muted-foreground">{t('subscriptionPlanPeriod', '/ month')}</span>
                </div>

                <ul className="space-y-2 text-xs">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary">✓</span>
                      <span>{t(`features.${feature}`, feature)}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.recommended ? 'default' : 'outline'}
                  className="w-full"
                >
                  {t('subscriptionSelectPlan', 'Select plan')}
                </Button>
              </Tile>
            ))}
          </div>

          <div className="mt-6 rounded-lg bg-muted/20 p-4 text-xs text-muted-foreground">
            <p>{t('subscriptionAnnualDiscount', 'Save 50% with annual billing. Contact us for enterprise pricing.')}</p>
          </div>
        </SectionBody>
      </Section>
    </div>
  );
};

export default Plans;

const PlansCatalog = {
  starter: {
    code: 'starter' as const,
    label: 'Starter',
    basePrice: 298,
    description: 'Perfect for individuals testing offers',
    recommended: false,
    features: [
      '100 tokens/month',
      'Basic evaluation (1 token/offer)',
      '✅ Real click simulation',
      '✅ US proxy IP only',
      '✅ Offer management',
      'Email support',
    ],
  },
  professional: {
    code: 'professional' as const,
    label: 'Professional',
    basePrice: 998,
    description: 'Ideal for growing affiliate marketers',
    recommended: true,
    features: [
      '1,000 tokens/month',
      'AI evaluation (2 tokens/offer)',
      '✅ Real click simulation',
      '✅ 10+ global proxy regions',
      '✅ Offer link replacement',
      '✅ Multiple concurrent evaluations',
      'Priority support',
      'Advanced analytics',
    ],
  },
  elite: {
    code: 'elite' as const,
    label: 'Elite',
    basePrice: 2998,
    description: 'For teams running large-scale campaigns',
    recommended: false,
    features: [
      '10,000 tokens/month',
      'AI evaluation (2 tokens/offer)',
      '✅ Real click simulation',
      '✅ 100+ global proxy regions',
      '✅ Offer link replacement',
      '✅ 100 concurrent evaluations',
      '✅ Custom click curves',
      '✅ Risk alerts',
      '✅ All new features',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
  },
};
