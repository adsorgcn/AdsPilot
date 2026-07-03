import { useMemo } from 'react';
import useUserSession from '~/core/hooks/use-user-session';
import useUser from '~/core/hooks/use-user';
import UserRole from '~/lib/types/user-role';
import GlobalRole from '~/core/session/types/global-role';

/**
 * Hook to get the current user's role and permission checks
 *
 * Reads role from:
 * 1. app_metadata.role (SuperAdmin from Supabase Auth)
 * 2. user_metadata.role (deprecated)
 * 3. session.data.role (fallback)
 *
 * @returns {Object} User role information and permission helpers
 * @property {UserRole} role - The user's role (defaults to 'user')
 * @property {boolean} isAdmin - Whether the user is an administrator
 * @property {boolean} isUser - Whether the user is a regular user
 *
 * @example
 * function MyComponent() {
 *   const { isAdmin } = useUserRole();
 *
 *   if (!isAdmin) {
 *     return <AccessDenied />;
 *   }
 *
 *   return <AdminPanel />;
 * }
 */
export function useUserRole() {
  const session = useUserSession();
  const { data: user } = useUser();

  const role = useMemo(() => {
    // Priority 1: Check app_metadata.role (Supabase Auth metadata)
    const appMetadataRole = user?.app_metadata?.role;
    if (appMetadataRole === GlobalRole.SuperAdmin) {
      return UserRole.Admin;
    }

    // Priority 2: Check user_metadata.role (deprecated, for backward compatibility)
    const userMetadataRole = user?.user_metadata?.role;
    if (userMetadataRole === UserRole.Admin || userMetadataRole === 'admin') {
      return UserRole.Admin;
    }

    // Priority 3: Check session.data.role (fallback)
    const sessionRole = session?.data?.role;
    if (sessionRole === UserRole.Admin || sessionRole === 'admin') {
      return UserRole.Admin;
    }

    // Default to regular user
    return UserRole.User;
  }, [user?.app_metadata?.role, user?.user_metadata?.role, session?.data?.role]);

  const isAdmin = useMemo(() => {
    return role === UserRole.Admin;
  }, [role]);

  const isUser = useMemo(() => {
    return role === UserRole.User;
  }, [role]);

  return {
    role,
    isAdmin,
    isUser,
  };
}

export default useUserRole;
