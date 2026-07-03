"use client";

import { useTranslation } from 'react-i18next';

import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';

import type { TokenUsageSummary } from '~/lib/billing';

type Props = {
  usage?: TokenUsageSummary;
  loading?: boolean;
};

function UsageBreakdown({ usage, loading }: Props) {
  const { t, i18n } = useTranslation('common');
  const locale = i18n.language;
  const unit = t('tokens.summary.tokenUnit');

  const total = usage
    ? Object.values(usage.byService ?? {}).reduce((acc, value) => acc + value, 0)
    : 0;

  const entries = usage
    ? Object.entries(usage.byService ?? {}).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <Section>
      <SectionHeader
        title={t('tokens.usageBreakdown.title')}
        description={t('tokens.usageBreakdown.description')}
      />

      <SectionBody>
        {loading ? (
          <div className={'space-y-2'}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={'h-10 animate-pulse rounded-lg bg-muted/40'}
              />
            ))}
          </div>
        ) : entries.length ? (
          <ul className={'space-y-3'}>
            {entries.map(([service, amount]) => {
              const ratio = total > 0 ? (amount / total) * 100 : 0;

              return (
                <li key={service} className={'space-y-1'}>
                  <div className={'flex items-center justify-between text-xs text-muted-foreground'}>
                    <span className={'font-medium text-foreground'}>{service}</span>
                    <span>
                      {t('tokens.usageBreakdown.entry', {
                        amount: formatNumber(amount, locale),
                        unit,
                        ratio: ratio.toFixed(1),
                      })}
                    </span>
                  </div>

                  <div className={'h-2 rounded-full bg-muted'}>
                    <div
                      className={'h-2 rounded-full bg-primary'}
                      style={{ width: `${Math.min(100, ratio)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={'rounded-lg border border-dashed border-border bg-muted/10 p-6 text-sm text-muted-foreground'}>
            {t('tokens.usageBreakdown.empty')}
          </div>
        )}

        {usage ? (
          <p className={'pt-4 text-xs text-muted-foreground'}>
            {t('tokens.usageBreakdown.summary', {
              start: formatDate(usage.startDate, locale),
              end: formatDate(usage.endDate, locale),
              total: formatNumber(total, locale),
              unit,
            })}
          </p>
        ) : null}
      </SectionBody>
    </Section>
  );
}

export default UsageBreakdown;

function formatNumber(value: number | undefined, locale: string) {
  return new Intl.NumberFormat(locale).format(value ?? 0);
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
