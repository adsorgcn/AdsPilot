import { useTranslation } from 'react-i18next';
import { ClipboardDocumentCheckIcon, SparklesIcon, BookOpenIcon } from '@heroicons/react/24/outline';

import { ResourceEmptyState } from '~/core/ui/ResourceState';
import ActionCard from '~/core/ui/ActionCard';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';

interface TasksGettingStartedProps {
  onGoOffers: () => void;
  onConnectAds: () => void;
  onViewDocs: () => void;
}

export default function TasksGettingStarted({
  onGoOffers,
  onConnectAds,
  onViewDocs,
}: TasksGettingStartedProps) {
  const { t } = useTranslation('common');

  return (
    <div className={'space-y-6'}>
      <FadeIn>
        <ResourceEmptyState
          title={t('tasks.gettingStarted.emptyTitle')}
          description={t('tasks.gettingStarted.emptyDescription')}
          primaryAction={{
            label: t('tasks.gettingStarted.createEvaluationTask'),
            onClick: onGoOffers,
          }}
          secondaryAction={{
            label: t('tasks.gettingStarted.connectAdAccount'),
            variant: 'outline',
            onClick: onConnectAds,
          }}
        />
      </FadeIn>

      <FadeInStagger className={'grid grid-cols-1 gap-4 md:grid-cols-3'}>
        <FadeInStaggerItem>
          <ActionCard
            title={t('tasks.gettingStarted.batchEvaluationTitle')}
            description={t('tasks.gettingStarted.batchEvaluationDesc')}
            icon={ClipboardDocumentCheckIcon}
            actionLabel={t('tasks.gettingStarted.goToOfferManagement')}
            onAction={onGoOffers}
            priority={'medium'}
          />
        </FadeInStaggerItem>

        <FadeInStaggerItem>
          <ActionCard
            title={t('tasks.gettingStarted.syncAdAccountTitle')}
            description={t('tasks.gettingStarted.syncAdAccountDesc')}
            icon={SparklesIcon}
            actionLabel={t('tasks.gettingStarted.connectAccount')}
            onAction={onConnectAds}
            priority={'low'}
          />
        </FadeInStaggerItem>

        <FadeInStaggerItem>
          <ActionCard
            title={t('tasks.gettingStarted.viewGuideTitle')}
            description={t('tasks.gettingStarted.viewGuideDesc')}
            icon={BookOpenIcon}
            actionLabel={t('tasks.gettingStarted.viewDocs')}
            onAction={onViewDocs}
            priority={'high'}
          />
        </FadeInStaggerItem>
      </FadeInStagger>
    </div>
  );
}
