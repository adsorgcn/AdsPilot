import { withI18n } from '~/i18n/with-i18n';
import AdminHeader from '../components/AdminHeader';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import dynamic from 'next/dynamic';
import FadeIn from '~/components/FadeIn';

// ✅ 动态导入大型配置组件以减少bundle大小
const SubscriptionConfigManagement = dynamic(
  () => import('./components/SubscriptionConfigManagement'),
  {
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted" />,
  }
);

export const metadata = {
  title: 'Subscription Configuration Management',
};

function SubscriptionConfigPage() {
  return (
    <>
      <AdminHeader>Subscription Configuration</AdminHeader>

      <AdminPageLayout>
        <FadeIn>
          <div className="flex flex-col space-y-6">
            {/* Configuration Management */}
            <SubscriptionConfigManagement />
          </div>
        </FadeIn>
      </AdminPageLayout>
    </>
  );
}

export default withI18n(SubscriptionConfigPage);