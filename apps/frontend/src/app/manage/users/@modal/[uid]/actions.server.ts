'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  banAdminUser,
  deleteAdminUser,
  impersonateAdminUser,
  reactivateAdminUser,
} from '~/lib/admin';
import { withAdminSession } from '~/core/generic/actions-utils';
import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';

export const banUser = withAdminSession(async ({ userId }: { userId: string }) => {
  await assertUserIsNotCurrentSuperAdmin(userId);
  await banAdminUser(userId);
  revalidatePath('/admin/users');
});

export const reactivateUser = withAdminSession(
  async ({ userId }: { userId: string }) => {
    await assertUserIsNotCurrentSuperAdmin(userId);
    await reactivateAdminUser(userId);
    revalidatePath('/admin/users');
  },
);

export const impersonateUser = withAdminSession(
  async ({ userId }: { userId: string }) => {
    await assertUserIsNotCurrentSuperAdmin(userId);

    const tokens = await impersonateAdminUser(userId);

    return tokens;
  },
);

export const deleteUserAction = withAdminSession(
  async ({ userId }: { userId: string }) => {
    await assertUserIsNotCurrentSuperAdmin(userId);

    const logger = getLogger();

    logger.info({ userId }, `Admin requested to delete user account`);

    await deleteAdminUser(userId);

    revalidatePath('/admin/users', 'page');

    logger.info({ userId }, `User account deleted`);

    redirect('/admin/users');
  },
);

async function assertUserIsNotCurrentSuperAdmin(targetUserId: string) {
  const client = getSupabaseServerActionClient();
  const { data } = await client.auth.getUser();
  const currentUserId = data.user?.id;

  if (!currentUserId) {
    throw new Error(`Unable to resolve current user`);
  }

  if (currentUserId === targetUserId) {
    throw new Error(
      `You cannot perform a destructive action on your own account as a Super Admin`,
    );
  }
}

