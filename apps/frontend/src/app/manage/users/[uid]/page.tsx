import AdminHeader from '~/app/manage/components/AdminHeader';
import AdminGuard from '~/app/manage/components/AdminGuard';
import FadeIn from '~/components/FadeIn';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import configuration from '~/configuration';
import {
  fetchAdminUser,
} from '~/lib/admin';

import UserActionsDropdown from './components/UserActionsDropdown';
import UserDetailsSection from './components/UserDetailsSection';
import TokensSection from './components/TokensSection';
import ActivitySection from './components/ActivitySection';
import UserPageBreadcrumbs from './components/UserPageBreadcrumbs';
import { extractDisplayName } from './utils/userHelpers';

interface Params {
  params: {
    uid: string;
  };
}

export const metadata = {
  title: `Manage User | ${configuration.site.siteName}`,
};

async function AdminUserPage({ params }: Params) {
  const uid = params.uid;

  const { user, activity } = await fetchAdminUser(uid);

  const displayName = extractDisplayName(user);
  const email = user.email;
  const isBanned = Boolean(user.isBanned);

  return (
    <div className={'flex flex-col flex-1'}>
      <AdminHeader>Manage User</AdminHeader>

      <AdminPageLayout>
        <FadeIn>
          <div className={'flex flex-col space-y-6'}>
            <div className={'flex justify-between'}>
              <UserPageBreadcrumbs displayName={displayName ?? email ?? user.id} />

              <div>
                <UserActionsDropdown uid={uid} isBanned={isBanned} />
              </div>
            </div>

            <UserDetailsSection
              user={user}
              displayName={displayName}
              email={email}
              isBanned={isBanned}
            />

            <TokensSection user={user} tokens={null} />

            <ActivitySection activity={activity as any[] ?? []} />
          </div>
        </FadeIn>
      </AdminPageLayout>
    </div>
  );
}

export default AdminGuard(AdminUserPage);
