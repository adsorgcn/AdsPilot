import { withI18n } from '~/i18n/with-i18n';
import AdminHeader from '../components/AdminHeader';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import SubscriptionStatsCards from './components/SubscriptionStatsCards';
import SubscriptionManagementClient from './components/SubscriptionManagementClient';
import FadeIn from '~/components/FadeIn';

export const metadata = {
  title: 'Subscription Management',
};

function SubscriptionManagementPage() {
  return (
    <>
      <AdminHeader>Subscription Management</AdminHeader>

      <AdminPageLayout>
        <FadeIn>
          <div className="flex flex-col space-y-6">
            {/* Statistics Cards */}
            <SubscriptionStatsCards />

            {/* Subscription Management Table */}
            <div className="border-t pt-6">
              <h2 className="mb-4 text-lg font-semibold">Subscriptions</h2>
              <SubscriptionManagementClient />
            </div>
          </div>
        </FadeIn>
      </AdminPageLayout>
    </>
  );
}

export default withI18n(SubscriptionManagementPage);
