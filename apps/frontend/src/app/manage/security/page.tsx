import { withI18n } from '~/i18n/with-i18n';
import AdminHeader from '../components/AdminHeader';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import SecurityManagementClient from './components/SecurityManagementClient';
import SecurityStatsCards from './components/SecurityStatsCards';
import FadeIn from '~/components/FadeIn';

export const metadata = {
  title: 'Security Settings',
};

function SecurityPage() {
  return (
    <>
      <AdminHeader>Security Settings</AdminHeader>

      <AdminPageLayout>
        <FadeIn>
          <div className="flex flex-col space-y-6">
            {/* Statistics Cards */}
            <SecurityStatsCards />

            {/* Info Alert */}
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-primary">
                  About Recovery Codes
                </h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>
                    Recovery codes allow administrators to access the system when
                    Google OAuth is unavailable. Each code can only be used once
                    and expires after 90 days.
                  </p>
                  <p className="mt-2">
                    <strong>Format:</strong> ABCD-EFGH-IJKL-MNOP (16 characters)
                  </p>
                  <p className="mt-1">
                    <strong>Usage:</strong> Visit{' '}
                    <a
                      href="/auth/recovery"
                      className="text-primary underline hover:opacity-80"
                    >
                      /auth/recovery
                    </a>{' '}
                    to use a recovery code
                  </p>
                </div>
              </div>
            </div>
          </div>

            {/* Recovery Code Management */}
            <SecurityManagementClient />
          </div>
        </FadeIn>
      </AdminPageLayout>
    </>
  );
}

export default withI18n(SecurityPage);
