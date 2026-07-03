"use client";

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import Tile from '~/core/ui/Tile';
import Button from '~/core/ui/Button';

import type { TokenBalance, TokenUsageSummary, SubscriptionInfo } from '~/lib/billing';

type Props = {
  balance?: TokenBalance;
  usage?: TokenUsageSummary;
  subscription?: SubscriptionInfo | null;
  loading?: boolean;
};

const SAFE_DAYS = 10;
const WARNING_DAYS = 5;

export default function TokenInsights({ balance, usage, subscription, loading }: Props) {
  const { t, i18n } = useTranslation('common');
  const locale = i18n.language;

  const insights = useMemo(() => {
    return computeInsights(balance, usage);
  }, [balance, usage]);

  const { projection, healthTone } = insights;
  const recommendation = buildRecommendation({
    tone: healthTone,
    pendingCost: projection.pendingCost,
    averageDaily: projection.averageDaily,
    daysRemaining: projection.daysRemaining,
    t,
    locale,
  });

  const averageDailyDisplay = loading
    ? '—'
    : formatNumber(projection.averageDaily, locale, { maximumFractionDigits: 0 });

  const daysRemainingDisplay = loading
    ? '—'
    : projection.daysRemaining === Infinity
      ? t('tokens.insights.daysInfinity')
      : formatNumber(Math.max(0, Math.floor(projection.daysRemaining)), locale);

  const runOutDate = projection.runOutDate
    ? formatDate(projection.runOutDate, locale)
    : null;

  const trendHelper = t('tokens.insights.trendHelper', {
    days: projection.daysInRange,
    unit: t('tokens.summary.tokenUnit'),
  });

  const daysHelper =
    loading
      ? ''
      : projection.daysRemaining === Infinity
        ? t('tokens.insights.daysHelperInfinite')
        : t('tokens.insights.daysHelper', { date: runOutDate ?? '—' });

  const healthLabel = t(`tokens.insights.healthLabel.${healthTone}`);

  return (
    <Section>
      <SectionHeader
        title={t('tokens.insights.title')}
        description={t('tokens.insights.description')}
      />

      <SectionBody>
        <div className={'grid gap-4 md:grid-cols-2'}>
          <Tile>
            <Tile.Heading>{t('tokens.insights.trendHeading')}</Tile.Heading>
            <Tile.Body>
              <Tile.Figure>
                {averageDailyDisplay}
              </Tile.Figure>
              <p className={'text-xs text-muted-foreground'}>{trendHelper}</p>
            </Tile.Body>
          </Tile>

          <Tile>
            <Tile.Heading>{t('tokens.insights.daysHeading')}</Tile.Heading>
            <Tile.Body>
              <div className={`text-3xl font-bold ${toneToTextColor(healthTone)}`}>
                {daysRemainingDisplay}
              </div>
              <p className={'text-xs text-muted-foreground'}>
                {daysHelper}
              </p>
            </Tile.Body>
          </Tile>
        </div>

        <div className={'mt-4 space-y-3 rounded-lg border border-border bg-muted/20 p-4 text-sm'}>
          <div className={`font-medium ${toneToTextColor(healthTone)}`}>{healthLabel}</div>
          <ul className={'list-disc space-y-2 pl-5'}>
            {recommendation.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className={'flex flex-wrap gap-2 pt-2 text-xs text-muted-foreground'}>
            {recommendation.actions.map((action) => (
              <Button
                key={action.label}
                size={'sm'}
                variant={action.primary ? 'default' : 'outline'}
                href={action.href}
              >
                {action.label}
              </Button>
            ))}
            {subscription ? (
              <span className={'pt-2'}>
                {t('tokens.insights.subscriptionLabel')}：<strong>{subscription.planName}</strong>{' '}
                {t('tokens.insights.subscriptionRenewal', {
                  date: formatDate(subscription.currentPeriodEnd, locale),
                })}
              </span>
            ) : null}
          </div>
        </div>
      </SectionBody>
    </Section>
  );
}

function computeInsights(balance?: TokenBalance, usage?: TokenUsageSummary) {
  const totalBalance = balance?.totalBalance ?? balance?.currentBalance ?? 0;
  const pendingCost = balance?.estimatedCostForPending ?? 0;
  const available = Math.max(0, totalBalance - pendingCost);

  const { daysInRange, averageDaily } = getAverageDaily(usage);

  const daysRemaining =
    averageDaily > 0 ? Math.max(0, available / averageDaily) : Infinity;

  const runOutDate =
    daysRemaining === Infinity
      ? null
      : new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);

  const healthTone: HealthTone =
    daysRemaining === Infinity
      ? 'info'
      : daysRemaining <= WARNING_DAYS
        ? 'error'
        : daysRemaining <= SAFE_DAYS
          ? 'warn'
          : 'success';

  return {
    projection: {
      available,
      pendingCost,
      averageDaily,
      daysRemaining,
      runOutDate,
      daysInRange,
    },
    healthTone,
  };
}

function getAverageDaily(usage?: TokenUsageSummary) {
  if (!usage) {
    return {
      daysInRange: 0,
      averageDaily: 0,
    };
  }

  const start = new Date(usage.startDate);
  const end = new Date(usage.endDate);
  const diff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const averageDaily = usage.totalConsumed > 0 ? usage.totalConsumed / diff : 0;

  return {
    daysInRange: diff,
    averageDaily,
  };
}

type HealthTone = 'success' | 'warn' | 'error' | 'info';

function toneToTextColor(tone: HealthTone) {
  switch (tone) {
    case 'success':
      return 'text-emerald-600';
    case 'warn':
      return 'text-amber-600';
    case 'error':
      return 'text-red-600';
    default:
      return 'text-muted-foreground';
  }
}

type Recommendation = {
  items: string[];
  actions: Array<{ label: string; href: string; primary?: boolean }>;
};

function buildRecommendation({
  tone,
  pendingCost,
  averageDaily,
  daysRemaining,
  t,
  locale,
}: {
  tone: HealthTone;
  pendingCost: number;
  averageDaily: number;
  daysRemaining: number;
  t: (key: string, options?: Record<string, unknown>) => string;
  locale: string;
}): Recommendation {
  const defaultActions = [
    {
      label: t('tokens.insights.recommendation.actions.viewSubscription'),
      href: '../settings/subscription',
      primary: tone === 'error',
    },
    {
      label: t('tokens.insights.recommendation.actions.reviewHighUsage'),
      href: '/tasks',
    },
  ];

  const averageRounded = Math.round(averageDaily);
  const averageFormatted = formatNumber(averageRounded, locale);
  const daysRemainingFloor = Math.max(0, Math.floor(daysRemaining));
  const daysFormatted = formatNumber(daysRemainingFloor, locale);
  const pendingFormatted = formatNumber(Math.round(pendingCost), locale);

  if (tone === 'success') {
    return {
      items: [
        t('tokens.insights.recommendation.success.item1', {
          average: averageFormatted,
        }),
        t('tokens.insights.recommendation.success.item2'),
      ],
      actions: [
        {
          label: t('tokens.insights.recommendation.actions.viewSyncStatus'),
          href: '/adscenter',
        },
        defaultActions[1],
      ],
    };
  }

  if (tone === 'warn') {
    return {
      items: [
        t('tokens.insights.recommendation.warn.item1', {
          days: daysFormatted,
        }),
        t('tokens.insights.recommendation.warn.item2', {
          pending: pendingFormatted,
        }),
      ],
      actions: defaultActions,
    };
  }

  if (tone === 'error') {
    return {
      items: [
        t('tokens.insights.recommendation.error.item1', {
          days: daysFormatted,
        }),
        t('tokens.insights.recommendation.error.item2'),
      ],
      actions: defaultActions,
    };
  }

  return {
    items: [
      t('tokens.insights.recommendation.info.item1'),
      t('tokens.insights.recommendation.info.item2'),
    ],
    actions: [
      {
        label: t('tokens.insights.recommendation.actions.viewTasks'),
        href: '/tasks',
      },
    ],
  };
}

function formatNumber(value: number | undefined, locale: string, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value ?? 0);
}

function formatDate(value: string | Date, locale: string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
