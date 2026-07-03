import BanUserModal from '../components/BanUserModal';
import AdminGuard from '~/app/manage/components/AdminGuard';
import { fetchAdminUser } from '~/lib/admin';

interface Params {
  params: {
    uid: string;
  };
}

async function BanUserModalPage({ params }: Params) {
  const { user } = await fetchAdminUser(params.uid);

  if (user.isBanned) {
    throw new Error(`The user is already banned`);
  }

  return (
    <BanUserModal
      user={{
        id: user.id,
        email: user.email ?? undefined,
        displayName: extractDisplayName(user),
      }}
    />
  );
}

export default AdminGuard(BanUserModalPage);

function extractDisplayName(user: Awaited<ReturnType<typeof fetchAdminUser>>['user']) {
  const metadata = (user.userMetadata ?? {}) as Record<string, unknown>;
  const value = metadata.displayName ?? metadata.display_name;

  return typeof value === 'string' ? value : undefined;
}
