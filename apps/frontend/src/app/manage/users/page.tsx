import AdminHeader from '~/app/manage/components/AdminHeader';
import AdminGuard from '~/app/manage/components/AdminGuard';
import UsersTable, {
  type AdminUserRow,
} from '~/app/manage/users/components/UsersTable';
import getPageFromQueryParams from '~/app/manage/utils/get-page-from-query-param';
import { AdminPageLayout } from '~/core/ui/PageLayout';
import configuration from '~/configuration';
import { fetchAdminUsers, type AdminUser } from '~/lib/admin';
import { createAdminBreadcrumbs } from '~/core/ui/Breadcrumbs';
import type { Metadata } from 'next';

interface UsersAdminPageProps {
  searchParams: {
    page?: string;
  };
}

export const metadata: Metadata = {
  title: `Users | ${configuration.site.siteName}`,
};

async function UsersAdminPage({ searchParams }: UsersAdminPageProps) {
  const page = getPageFromQueryParams(searchParams.page);
  const perPage = 20;
  const { rows, total, perPage: pageSize } = await loadUsers(page, perPage);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const breadcrumbs = createAdminBreadcrumbs([{ label: 'Users' }]);

  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader breadcrumbs={breadcrumbs}>Users</AdminHeader>

      <AdminPageLayout>
        <UsersTable
          users={rows}
          page={page}
          pageCount={pageCount}
          perPage={pageSize}
        />
      </AdminPageLayout>
    </div>
  );
}

export default AdminGuard(UsersAdminPage);

async function loadUsers(page = 1, perPage = 20) {
  const response = await fetchAdminUsers({ page, perPage });

  return {
    rows: response.users.map(mapAdminUserToRow),
    total: response.totalCount,
    perPage: response.perPage,
  };
}

function mapAdminUserToRow(user: AdminUser): AdminUserRow {
  const userMetadata = (user.userMetadata ?? {}) as Record<string, unknown>;

  return {
    id: user.id,
    email: user.email,
    phone: extractString(userMetadata, ['phone', 'phoneNumber']),
    displayName: extractString(userMetadata, ['displayName', 'display_name']),
    photoUrl: extractString(userMetadata, ['photoUrl', 'photo_url']),
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt ?? undefined,
    role: user.role,
    isBanned: Boolean(user.isBanned),
    tokenBalance: user.tokenBalance ?? null,
    planName: user.planName ?? null,
  };
}

function extractString(
  metadata: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  return undefined;
}
