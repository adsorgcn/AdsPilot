'use client';

import type { UserRole } from '~/core/session/types/user-session';
import useUserSession from '~/core/hooks/use-user-session';

/**
 * @name IfHasPermissions
 * @description
 * This component can guard the visibility of portions of the page
 * based on the signed-in user's role.
 *
 * We recommend to always import the logic handler function from a central
 * place instead of defining inline, to avoid permissions and rules getting
 * messy and scattered in the codebase
 *
 * For example:
 *  - <IfHasPermissions condition={canChangeBilling}>     // GOOD
 *  - <IfHasPermissions condition={(role) => role === 'admin'}>   // BAD
 *
 * @param children
 * @param condition
 * @param fallback
 * @constructor
 */
function IfHasPermissions({
  children,
  condition,
  fallback = null,
}: React.PropsWithChildren<{
  condition: (role: UserRole) => boolean;
  fallback?: React.ReactNode | null;
}>) {
  const session = useUserSession();
  const currentUserRole = session?.role;

  if (currentUserRole === undefined || !condition(currentUserRole)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

export default IfHasPermissions;
