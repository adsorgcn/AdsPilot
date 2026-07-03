import { withI18n } from '~/i18n/with-i18n';
import AdminHeader from '../components/AdminHeader';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import UserGrowthChart from './components/UserGrowthChart';
import TokenConsumptionChart from './components/TokenConsumptionChart';
import RevenueChart from './components/RevenueChart';
import ActivityMetrics from './components/ActivityMetrics';
import FadeIn from '~/components/FadeIn';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics Dashboard',
};

function AnalyticsDashboardPage() {
  return (
    <>
      <AdminHeader>Analytics Dashboard</AdminHeader>

      <AdminPageLayout>
        <FadeIn>
          <div className="flex flex-col space-y-8">
            {/* User Growth Analytics */}
            <div>
              <h2 className="mb-4 text-lg font-semibold">User Growth</h2>
              <UserGrowthChart />
            </div>

            {/* Token Consumption Analytics */}
            <div className="border-t pt-8">
              <h2 className="mb-4 text-lg font-semibold">Token Consumption</h2>
              <TokenConsumptionChart />
            </div>

            {/* Revenue Analytics */}
            <div className="border-t pt-8">
              <h2 className="mb-4 text-lg font-semibold">Revenue</h2>
              <RevenueChart />
            </div>

            {/* Activity Metrics */}
            <div className="border-t pt-8">
              <h2 className="mb-4 text-lg font-semibold">Activity Metrics</h2>
              <ActivityMetrics />
            </div>
          </div>
        </FadeIn>
      </AdminPageLayout>
    </>
  );
}

export default withI18n(AnalyticsDashboardPage);
