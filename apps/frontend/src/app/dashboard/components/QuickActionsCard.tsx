import { useRouter } from 'next/navigation';
import {
  ShoppingBagIcon,
  RectangleStackIcon,
  MegaphoneIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import QuickActionButton from './QuickActionButton';

interface QuickActionsCardProps {
  t: (key: string) => string;
}

export default function QuickActionsCard({ t }: QuickActionsCardProps) {
  const router = useRouter();

  return (
    <Card data-testid="quick-actions-card">
      <CardHeader>
        <CardTitle>{t('dashboard.quickActions.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionButton
            icon={ShoppingBagIcon}
            label={t('dashboard.quickActions.manageOffers')}
            description={t('dashboard.quickActions.manageOffersDesc')}
            onClick={() => router.push('/offers')}
            testId="quick-action-manage-offers"
          />

          <QuickActionButton
            icon={RectangleStackIcon}
            label={t('dashboard.quickActions.viewTasks')}
            description={t('dashboard.quickActions.viewTasksDesc')}
            onClick={() => router.push('/tasks')}
            testId="quick-action-view-tasks"
          />

          <QuickActionButton
            icon={MegaphoneIcon}
            label={t('dashboard.quickActions.adsCenter')}
            description={t('dashboard.quickActions.adsCenterDesc')}
            onClick={() => router.push('/adscenter')}
            testId="quick-action-ads-center"
          />

          <QuickActionButton
            icon={CurrencyDollarIcon}
            label={t('dashboard.quickActions.tokenManagement')}
            description={t('dashboard.quickActions.tokenManagementDesc')}
            onClick={() => router.push('/settings/tokens')}
            testId="quick-action-token-management"
          />

          <QuickActionButton
            icon={ShoppingBagIcon}
            label={t('dashboard.quickActions.createOffer')}
            description={t('dashboard.quickActions.createOfferDesc')}
            onClick={() => router.push('/offers?action=create')}
            variant="primary"
            testId="quick-action-create-offer"
          />
        </div>
      </CardContent>
    </Card>
  );
}
