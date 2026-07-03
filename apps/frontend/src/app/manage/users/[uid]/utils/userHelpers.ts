import type { AdminUser } from '~/lib/admin';

export function extractDisplayName(user: AdminUser) {
  const metadata = (user.userMetadata ?? {}) as Record<string, unknown>;

  return (
    extractString(metadata, ['displayName', 'display_name']) ??
    extractString(user.appMetadata ?? {}, ['name']) ??
    undefined
  );
}

function extractString(
  metadata: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = metadata?.[key];

    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  return undefined;
}
