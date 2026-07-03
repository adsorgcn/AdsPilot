import dynamic from 'next/dynamic';
import AdminHeader from '~/app/manage/components/AdminHeader';
import AdminGuard from '~/app/manage/components/AdminGuard';
import configuration from '~/configuration';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import FadeIn from '~/components/FadeIn';

// ✅ 懒加载任务统计卡片和管理客户端
const TaskStatsCards = dynamic(
  () => import('./components/TaskStatsCards'),
  {
    loading: () => <div className="h-32 animate-pulse rounded-lg bg-muted" />,
  }
);

const TaskManagementClient = dynamic(
  () => import('./components/TaskManagementClient'),
  {
    loading: () => <div className="h-96 animate-pulse rounded-lg bg-muted" />,
  }
);

export const metadata = {
  title: `Task Management | ${configuration.site.siteName}`,
};

function TasksManagementPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader>Task Management</AdminHeader>

      <AdminPageLayout>
        <FadeIn>
          <div className="flex flex-col space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Task Statistics</h2>
              <p className="text-sm text-muted-foreground">
                Monitor all user tasks across the platform
              </p>
            </div>

            <TaskStatsCards />

            <div className="border-t pt-6">
              <h2 className="mb-4 text-lg font-semibold">Task List</h2>
              <TaskManagementClient />
            </div>
          </div>
        </FadeIn>
      </AdminPageLayout>
    </div>
  );
}

export default AdminGuard(TasksManagementPage);
