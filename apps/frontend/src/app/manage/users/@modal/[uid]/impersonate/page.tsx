import AdminGuard from '~/app/manage/components/AdminGuard';
import ImpersonateUserConfirmationModal from '~/app/manage/users/@modal/[uid]/components/ImpersonateUserConfirmationModal';
import { fetchAdminUser } from '~/lib/admin';

interface Params {
  params: {
    uid: string;
  };
}

async function ImpersonateUserModalPage({ params }: Params) {
  const { user } = await fetchAdminUser(params.uid);

  return (
    <ImpersonateUserConfirmationModal
      user={{
        id: user.id,
        email: user.email ?? undefined,
        displayName: extractDisplayName(user),
      }}
    />
  );
}

export default AdminGuard(ImpersonateUserModalPage);

function extractDisplayName(user: Awaited<ReturnType<typeof fetchAdminUser>>['user']) {
  const metadata = (user.userMetadata ?? {}) as Record<string, unknown>;
  const value = metadata.displayName ?? metadata.display_name;

  return typeof value === 'string' ? value : undefined;
}

