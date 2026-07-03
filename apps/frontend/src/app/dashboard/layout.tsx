import loadAppData from '~/lib/server/loaders/load-app-data';
import AppLayout from '~/app/dashboard/components/AppLayout';

// Force dynamic rendering to avoid build-time execution
export const dynamic = 'force-dynamic';

async function DashboardLayout({
  children,
}: React.PropsWithChildren) {
  const data = await loadAppData();

  return <AppLayout data={data}>{children}</AppLayout>;
}

export default DashboardLayout;
