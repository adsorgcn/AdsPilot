import loadAppData from '~/lib/server/loaders/load-app-data';
import AuthenticatedPageLayout from '~/components/layout/AuthenticatedPageLayout';

// Force dynamic rendering to avoid build-time execution
export const dynamic = 'force-dynamic';

async function SettingsLayout({ children }: React.PropsWithChildren) {
  const data = await loadAppData();

  return (
    <AuthenticatedPageLayout data={data}>
      {children}
    </AuthenticatedPageLayout>
  );
}

export default SettingsLayout;
