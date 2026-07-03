import { useTranslation } from 'react-i18next';
import Spinner from '~/core/ui/Spinner';
import EmptyState from '~/core/ui/EmptyState';
import Badge from '~/core/ui/Badge';
import type { OfferEvaluationHistoryItem } from '~/lib/offers/types';
import { formatRelativeTime, formatNumber } from '../utils/format';

interface OfferEvaluationHistoryListProps {
  items: OfferEvaluationHistoryItem[];
  isLoading: boolean;
}

interface MetricItemProps {
  label: string;
  value: string;
}

function MetricItem({ label, value }: MetricItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export function OfferEvaluationHistoryList({
  items,
  isLoading,
}: OfferEvaluationHistoryListProps) {
  const { t } = useTranslation('common');

  if (isLoading) {
    return (
      <div className={'flex min-h-[160px] items-center justify-center'}>
        <Spinner className={'text-primary'} />
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        title={t('offers.detail.noHistoryTitle')}
        description={t('offers.detail.noHistoryDescription')}
        className="min-h-[160px]"
      />
    );
  }

  return (
    <div className={'space-y-3 pt-3'}>
      {items.map((item) => {
        const isAI = item.evaluationType === 'ai' || item.usedAI;
        return (
          <div
            key={item.id}
            className={'space-y-3 rounded-lg border border-border bg-background p-4 shadow-sm'}
          >
            <div className={'flex flex-wrap items-center justify-between gap-2'}>
              <div className={'flex items-center gap-3 text-sm text-muted-foreground'}>
                <span>{formatRelativeTime(item.evaluatedAt, t)}</span>
                <span>·</span>
                <span>{isAI ? t('offers.detail.aiEvaluation') : t('offers.detail.basicEvaluation')}</span>
                {typeof item.tokensConsumed === 'number' ? (
                  <>
                    <span>·</span>
                    <span>{t('offers.detail.tokensConsumed', { count: item.tokensConsumed })}</span>
                  </>
                ) : null}
              </div>
              {item.statusLabel ? (
                <Badge size={'small'} color={item.status === 'failed' ? 'error' : 'info'}>
                  {item.statusLabel}
                </Badge>
              ) : null}
            </div>

            {item.aiAnalysis ? (
              <div className={'rounded-md bg-primary/5 p-3 text-sm'}>
                <div className={'flex items-center justify-between'}>
                  <span className={'font-medium text-primary'}>
                    {t('offers.detail.aiScoreBadge', { score: item.aiAnalysis.recommendationScore })}
                  </span>
                  {item.aiAnalysis.category ? (
                    <span className={'text-xs text-muted-foreground'}>
                      {item.aiAnalysis.category}
                    </span>
                  ) : null}
                </div>
                {item.aiAnalysis.strengths?.length ? (
                  <ul className={'mt-2 space-y-1 text-muted-foreground'}>
                    {item.aiAnalysis.strengths.map((reason, index) => (
                      <li key={index}>• {reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {item.similarWebData ? (
              <div className={'grid gap-3 md:grid-cols-3'}>
                {typeof item.similarWebData.globalRank === 'number' ? (
                  <MetricItem label={t('offers.detail.globalRank')} value={`#${item.similarWebData.globalRank}`} />
                ) : null}
                {typeof item.similarWebData.monthlyVisits === 'number' ? (
                  <MetricItem
                    label={t('offers.detail.monthlyVisits')}
                    value={formatNumber(item.similarWebData.monthlyVisits)}
                  />
                ) : null}
                {typeof item.similarWebData.bounceRate === 'number' ? (
                  <MetricItem
                    label={t('offers.detail.bounceRate')}
                    value={`${(item.similarWebData.bounceRate * 100).toFixed(1)}%`}
                  />
                ) : null}
              </div>
            ) : null}

            {item.errorMessage ? (
              <div className={'rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600'}>
                {item.errorMessage}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
