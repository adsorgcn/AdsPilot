import { withI18n } from '~/i18n/with-i18n';
import AdminHeader from '../components/AdminHeader';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import TokenManagementClient from './components/TokenManagementClient';
import TokenStatsCards from './components/TokenStatsCards';
import FadeIn from '~/components/FadeIn';

export const metadata = {
  title: 'Token Management',
};

function TokenManagementPage() {
  return (
    <>
      <AdminHeader>Token Management</AdminHeader>

      <AdminPageLayout>
        <FadeIn>
          <div className="flex flex-col space-y-6">
            {/* Statistics Cards */}
            <TokenStatsCards />

            {/* Token Analytics - 关键运营指标 */}
            <div className="border-t pt-6">
              <h2 className="mb-4 text-lg font-semibold">Token Analytics</h2>
              <div className="rounded-lg border bg-card p-6">
                <p className="text-sm text-muted-foreground">
                  Token消费趋势和Top消费者分析功能开发中...
                </p>
              </div>
            </div>

            {/* Token Management Table */}
            <div className="border-t pt-6">
              <h2 className="mb-4 text-lg font-semibold">Token Balances</h2>
              <TokenManagementClient />
            </div>
          </div>
        </FadeIn>
      </AdminPageLayout>
    </>
  );
}

export default withI18n(TokenManagementPage);
