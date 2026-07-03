import AdminGuard from '~/app/manage/components/AdminGuard';
import ReactivateUserModal from '~/app/manage/users/@modal/[uid]/components/ReactivateUserModal';
import { fetchAdminUser } from '~/lib/admin';

interface Params {
  params: {
    uid: string;
  };
}

async function ReactivateUserModalPage({ params }: Params) {
  const { user } = await fetchAdminUser(params.uid);

  if (!user.isBanned) {
    throw new Error(`User is not banned`);
  }

  return (
    <ReactivateUserModal
      user={{
        id: user.id,
        email: user.email ?? undefined,
        displayName: extractDisplayName(user),
      }}
    />
  );
}

export default AdminGuard(ReactivateUserModalPage);

function extractDisplayName(user: Awaited<ReturnType<typeof fetchAdminUser>>['user']) {
  const metadata = (user.userMetadata ?? {}) as Record<string, unknown>;
  const value = metadata.displayName ?? metadata.display_name;

  return typeof value === 'string' ? value : undefined;
}

