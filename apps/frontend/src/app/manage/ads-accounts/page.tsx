import dynamic from 'next/dynamic';
import AdminHeader from '~/app/manage/components/AdminHeader';
import AdminGuard from '~/app/manage/components/AdminGuard';
import configuration from '~/configuration';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import FadeIn from '~/components/FadeIn';

// ✅ 懒加载广告账户统计卡片和管理客户端
const AdsAccountStatsCards = dynamic(
  () => import('./components/AdsAccountStatsCards'),
  {
    loading: () => <div className="h-40 animate-pulse rounded-lg bg-muted" />,
  }
);

const AdsAccountManagementClient = dynamic(
  () => import('./components/AdsAccountManagementClient'),
  {
    loading: () => <div className="h-96 animate-pulse rounded-lg bg-muted" />,
  }
);

export const metadata = {
  title: `Ads Accounts Management | ${configuration.site.siteName}`,
};

function AdsAccountsManagementPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader>Ads Accounts Management</AdminHeader>

      <AdminPageLayout>
        <FadeIn>
          <div className="flex flex-col space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Ads Account Statistics</h2>
              <p className="text-sm text-muted-foreground">
                Monitor all connected advertising accounts across the platform
              </p>
            </div>

            <AdsAccountStatsCards />

            <div className="border-t pt-6">
              <h2 className="mb-4 text-lg font-semibold">Accounts List</h2>
              <AdsAccountManagementClient />
            </div>
          </div>
        </FadeIn>
      </AdminPageLayout>
    </div>
  );
}

export default AdminGuard(AdsAccountsManagementPage);
