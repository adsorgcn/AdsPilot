import dynamic from 'next/dynamic';
import { withI18n } from '~/i18n/with-i18n';
import AdminHeader from '../components/AdminHeader';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import FadeIn from '~/components/FadeIn';

// ✅ 懒加载统计卡片和质量监控 - 这些组件可以延迟渲染
const OfferStatsCards = dynamic(
  () => import('./components/OfferStatsCards'),
  {
    loading: () => <div className="h-32 animate-pulse rounded-lg bg-muted" />,
  }
);

const OfferQualityMonitor = dynamic(
  () => import('./components/OfferQualityMonitor'),
  {
    loading: () => <div className="h-48 animate-pulse rounded-lg bg-muted" />,
  }
);

const OfferManagementClient = dynamic(
  () => import('./components/OfferManagementClient'),
  {
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted" />,
  }
);

export const metadata = {
  title: 'Offer Management',
};

function OfferManagementPage() {
  return (
    <>
      <AdminHeader>Offer Management</AdminHeader>

      <AdminPageLayout>
        <FadeIn>
          <div className="flex flex-col space-y-6">
            {/* Statistics Cards */}
            <OfferStatsCards />

            {/* Quality Monitoring */}
            <div className="border-t pt-6">
              <h2 className="mb-4 text-lg font-semibold">Quality Monitoring</h2>
              <OfferQualityMonitor />
            </div>

            {/* Offer Management Table */}
            <div className="border-t pt-6">
              <h2 className="mb-4 text-lg font-semibold">All Offers</h2>
              <OfferManagementClient />
            </div>
          </div>
        </FadeIn>
      </AdminPageLayout>
    </>
  );
}

export default withI18n(OfferManagementPage);
