import AdminHeader from '~/app/manage/components/AdminHeader';
import AdminGuard from '~/app/manage/components/AdminGuard';
import AdminDashboard from '~/app/manage/components/AdminDashboard';
import configuration from '~/configuration';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import { fetchAdminStats } from '~/lib/admin';

export const metadata = {
  title: `Admin | ${configuration.site.siteName}`,
};

async function AdminPage() {
  const stats = await loadStats();

  return (
    <div className={'flex flex-col flex-1'}>
      <AdminHeader>Admin</AdminHeader>

      <AdminPageLayout>
        <AdminDashboard stats={stats} />
      </AdminPageLayout>
    </div>
  );
}

export default AdminGuard(AdminPage);

async function loadStats() {
  try {
    return await fetchAdminStats();
  } catch (error) {
    console.warn('[admin] Failed to fetch stats', error);

    return {
      counters: {},
      updatedAt: new Date().toISOString(),
    };
  }
}
