import AdminGuard from '~/app/manage/components/AdminGuard';
import DeleteUserModal from '~/app/manage/users/@modal/[uid]/components/DeleteUserModal';
import { fetchAdminUser } from '~/lib/admin';

interface Params {
  params: {
    uid: string;
  };
}

async function DeleteUserModalPage({ params }: Params) {
  const { user } = await fetchAdminUser(params.uid);

  return (
    <DeleteUserModal
      user={{
        id: user.id,
        email: user.email ?? undefined,
        displayName: extractDisplayName(user),
      }}
    />
  );
}

export default AdminGuard(DeleteUserModalPage);

function extractDisplayName(user: Awaited<ReturnType<typeof fetchAdminUser>>['user']) {
  const metadata = (user.userMetadata ?? {}) as Record<string, unknown>;
  const value = metadata.displayName ?? metadata.display_name;

  return typeof value === 'string' ? value : undefined;
}

