"use client";

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import SettingsContentContainer from '~/app/settings/components/SettingsContentContainer';
import Button from '~/core/ui/Button';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';

import TokenSummaryTiles from './components/TokenSummaryTiles';
import UsageBreakdown from './components/UsageBreakdown';
import TokenTransactionsTable from './components/TokenTransactionsTable';
import TokenInsights from './components/TokenInsights';

import {
  useBillingTokenBalance,
  useSubscriptionInfo,
  useTokenTransactions,
  useTokenUsageSummary,
} from '~/lib/billing';

type RangeValue = '7d' | '30d';

function TokensSettingsPage() {
  const { t } = useTranslation('common');
  const [range, setRange] = useState<RangeValue>('7d');

  const RANGES: Array<{ label: string; value: RangeValue }> = useMemo(() => [
    { label: t('tokens.last7Days'), value: '7d' },
    { label: t('tokens.last30Days'), value: '30d' },
  ], [t]);

  const { startDate, endDate} = useMemo(() => getRange(range), [range]);

  const {
    data: balance,
    isLoading: balanceLoading,
    error: balanceError,
  } = useBillingTokenBalance();

  const {
    data: transactions,
    isLoading: transactionsLoading,
    error: transactionsError,
  } = useTokenTransactions();

  const {
    data: usage,
    isLoading: usageLoading,
    error: usageError,
  } = useTokenUsageSummary({ startDate, endDate });

  const { data: subscription } = useSubscriptionInfo();

  const errors = [balanceError, transactionsError, usageError].filter(Boolean);

  return (
    <SettingsContentContainer>
      <div className={'flex flex-col space-y-6'}>
        {errors.length ? (
          <Section>
            <SectionBody>
              <div className={'rounded-lg border border-red-500/40 bg-red-50 p-4 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400'}>
                {t('tokens.errorLoadingData')}
              </div>
            </SectionBody>
          </Section>
        ) : null}

        <TokenSummaryTiles balance={balance} loading={balanceLoading} />

        <TokenInsights
          balance={balance}
          usage={usage}
          subscription={subscription}
          loading={balanceLoading || usageLoading}
        />

        <Section>
          <SectionHeader
            title={t('tokens.consumptionTrend')}
            description={t('tokens.consumptionTrendDescription')}
          />

          <SectionBody className={'space-y-4'}>
            <div className={'flex flex-wrap gap-2'}>
              {RANGES.map((item) => (
                <Button
                  key={item.value}
                  size={'sm'}
                  variant={range === item.value ? 'default' : 'outline'}
                  onClick={() => {
                    setRange(item.value);
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            <UsageBreakdown usage={usage} loading={usageLoading} />
          </SectionBody>
        </Section>

        <Section>
          <SectionHeader
            title={t('tokens.transactionHistory')}
            description={t('tokens.transactionHistoryDescription')}
          />

          <SectionBody>
            <TokenTransactionsTable
              transactions={(transactions ?? []).slice(0, 50)}
              loading={transactionsLoading}
            />
          </SectionBody>
        </Section>

        <div className={'rounded-lg border border-border bg-muted/10 p-4'}>
          <div className={'flex items-center justify-between'}>
            <div>
              <p className={'text-sm font-medium'}>{t('tokens.currentPlan')}</p>
              <p className={'mt-1 text-xs text-muted-foreground'}>
                {subscription?.planName || t('tokens.notSubscribed')}
                {subscription?.currentPeriodEnd && (
                  <span className={'ml-2'}>
                    · {t('tokens.renewsOn')} {formatDate(subscription.currentPeriodEnd)}
                  </span>
                )}
              </p>
            </div>
            <Button
              size={'sm'}
              variant={'outline'}
              href={'../settings/subscription'}
            >
              {t('tokens.managePlan')}
            </Button>
          </div>
        </div>
      </div>
    </SettingsContentContainer>
  );
}

export default TokensSettingsPage;

function getRange(range: RangeValue) {
  const end = new Date();
  const start = new Date();

  if (range === '7d') {
    start.setDate(end.getDate() - 6);
  } else {
    start.setDate(end.getDate() - 29);
  }

  return {
    startDate: toISOString(start, true),
    endDate: toISOString(end, false),
  };
}

function toISOString(date: Date, floorToStartOfDay: boolean) {
  const cloned = new Date(date);

  if (floorToStartOfDay) {
    cloned.setHours(0, 0, 0, 0);
  } else {
    cloned.setHours(23, 59, 59, 999);
  }

  return cloned.toISOString();
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
