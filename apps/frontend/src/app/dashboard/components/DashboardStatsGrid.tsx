import { useRouter } from 'next/navigation';
import {
  ShoppingBagIcon,
  RectangleStackIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import { LoadingSpinner } from '~/components/ui/loading-dots';
import StatCard from './StatCard';

interface DashboardStatsGridProps {
  totalOffers: number;
  pendingOffers: number;
  readyOffers: number;
  tokenBalance: number | undefined;
  isLoading: boolean;
  tokensLoading: boolean;
  t: (key: string, params?: any) => string;
}

export default function DashboardStatsGrid({
  totalOffers,
  pendingOffers,
  readyOffers,
  tokenBalance,
  isLoading,
  tokensLoading,
  t,
}: DashboardStatsGridProps) {
  const router = useRouter();

  return (
    <FadeInStagger>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="dashboard-stats-grid">
        <FadeInStaggerItem>
          <StatCard
            title={t('dashboard.stats.totalOffers')}
            value={isLoading ? <LoadingSpinner size="sm" /> : totalOffers}
            icon={ShoppingBagIcon}
            trend={totalOffers > 0 ? 'up' : undefined}
            onClick={() => router.push('/offers')}
            testId="stat-card-total-offers"
            t={t}
          />
        </FadeInStaggerItem>

        <FadeInStaggerItem>
          <StatCard
            title={t('dashboard.stats.pendingOffers')}
            value={isLoading ? <LoadingSpinner size="sm" /> : pendingOffers}
            icon={RectangleStackIcon}
            badge={pendingOffers > 0 ? { label: t('dashboard.stats.needsAction'), color: 'error' } : undefined}
            onClick={() => router.push('/offers?status=pending_evaluation')}
            testId="stat-card-pending-offers"
            t={t}
          />
        </FadeInStaggerItem>

        <FadeInStaggerItem>
          <StatCard
            title={t('dashboard.stats.readyOffers')}
            value={isLoading ? <LoadingSpinner size="sm" /> : readyOffers}
            icon={ArrowTrendingUpIcon}
            badge={readyOffers > 0 ? { label: t('dashboard.stats.ready'), color: 'success' } : undefined}
            onClick={() => router.push('/offers?status=ready_to_deploy')}
            testId="stat-card-ready-offers"
            t={t}
          />
        </FadeInStaggerItem>

        <FadeInStaggerItem>
          <StatCard
            title={t('dashboard.stats.remainingTokens')}
            value={tokensLoading ? <LoadingSpinner size="sm" /> : (tokenBalance ?? 0)}
            icon={CurrencyDollarIcon}
            badge={tokenBalance && tokenBalance > 0 ? { label: `${tokenBalance}`, color: 'info' } : undefined}
            onClick={() => router.push('/settings/tokens')}
            testId="stat-card-tokens"
            t={t}
          />
        </FadeInStaggerItem>
      </div>
    </FadeInStagger>
  );
}
