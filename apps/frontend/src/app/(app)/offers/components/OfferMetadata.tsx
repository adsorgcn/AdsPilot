import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Offer } from '~/lib/offers';
import { formatRelativeTime, formatDate, formatEvaluationStatus } from '../utils/format';

interface OfferMetadataProps {
  offer: Offer | null;
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

export function OfferMetadata({ offer }: OfferMetadataProps) {
  const { t } = useTranslation('common');

  const metadata = useMemo(() => {
    if (!offer) {
      return [] as Array<{ label: string; value: string }>;
    }

    const list: Array<{ label: string; value: string }> = [
      { label: t('offers.detail.landingPage'), value: offer.url },
      { label: t('offers.detail.primaryMarket'), value: offer.country },
      {
        label: t('offers.detail.lastUpdated'),
        value: formatRelativeTime(offer.updatedAt ?? offer.createdAt, t),
      },
      {
        label: t('offers.detail.createdAt'),
        value: formatDate(offer.createdAt),
      },
    ];

    if (typeof offer.healthScore === 'number') {
      list.push({
        label: t('offers.detail.aiRecommendationScore'),
        value: String(offer.healthScore),
      });
    }

    if (offer.lastEvaluationStatus) {
      list.push({
        label: t('offers.detail.lastEvaluationStatus'),
        value: formatEvaluationStatus(offer.lastEvaluationStatus, t),
      });
    }

    if (typeof offer.lastEvaluationTokens === 'number') {
      list.push({
        label: t('offers.detail.lastEvaluationTokens'),
        value: `${offer.lastEvaluationTokens}`,
      });
    }

    if (offer.lastEvaluatedAt) {
      list.push({
        label: t('offers.detail.lastEvaluatedAt'),
        value: formatRelativeTime(offer.lastEvaluatedAt, t),
      });
    }

    return list;
  }, [offer, t]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {metadata.map((item) => (
        <MetricItem key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}
