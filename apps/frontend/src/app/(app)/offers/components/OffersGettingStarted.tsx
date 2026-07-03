import { useTranslation } from 'react-i18next';
import { SparklesIcon, BoltIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { ResourceEmptyState } from '~/core/ui/ResourceState';
import ActionCard from '~/core/ui/ActionCard';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';

interface OffersGettingStartedProps {
  onCreate: () => void;
  onConnectAds: () => void;
  onViewDocs: () => void;
}

export function OffersGettingStarted({
  onCreate,
  onConnectAds,
  onViewDocs,
}: OffersGettingStartedProps) {
  const { t } = useTranslation('common');

  return (
    <div className={'space-y-6'}>
      <FadeIn>
        <ResourceEmptyState
          title={t('offers.gettingStarted.title')}
          description={t('offers.gettingStarted.description')}
          primaryAction={{
            label: t('offers.ui.createOffer'),
            onClick: onCreate,
          }}
          secondaryAction={{
            label: t('offers.gettingStarted.connectAdsAccount'),
            variant: 'outline',
            onClick: onConnectAds,
          }}
        />
      </FadeIn>

      <FadeInStagger className={'grid grid-cols-1 gap-4 md:grid-cols-3'}>
        <FadeInStaggerItem>
          <ActionCard
            title={t('offers.gettingStarted.quickEvaluationTitle')}
            description={t('offers.gettingStarted.quickEvaluationDescription')}
            icon={SparklesIcon}
            actionLabel={t('offers.gettingStarted.quickEvaluationAction')}
            onAction={onViewDocs}
            priority={'low'}
          />
        </FadeInStaggerItem>

        <FadeInStaggerItem>
          <ActionCard
            title={t('offers.gettingStarted.syncAdsTitle')}
            description={t('offers.gettingStarted.syncAdsDescription')}
            icon={BoltIcon}
            actionLabel={t('offers.gettingStarted.syncAdsAction')}
            onAction={onConnectAds}
            priority={'medium'}
          />
        </FadeInStaggerItem>

        <FadeInStaggerItem>
          <ActionCard
            title={t('offers.gettingStarted.tutorialTitle')}
            description={t('offers.gettingStarted.tutorialDescription')}
            icon={BookOpenIcon}
            actionLabel={t('offers.gettingStarted.tutorialAction')}
            onAction={onViewDocs}
            priority={'high'}
          />
        </FadeInStaggerItem>
      </FadeInStagger>
    </div>
  );
}
