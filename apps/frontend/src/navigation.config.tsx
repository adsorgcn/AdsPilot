import configuration from '~/configuration';
import { createIconRenderer } from '~/components/icons';
import type { SubscriptionTier } from '~/lib/types/subscription';
import UserRole from '~/lib/types/user-role';

type Divider = {
  divider: true;
};

type Permission = {
  subscriptionTiers?: SubscriptionTier[];
  featureFlag?: keyof typeof configuration.features;
  requiredRole?: UserRole;  // User role requirement (user/admin)
};

type NavigationItemLink = {
  label: string;
  path: string;
  Icon: (props: { className: string }) => JSX.Element;
  end?: boolean;
  permission?: Permission;
};

type NavigationGroup = {
  label: string;
  collapsible?: boolean;
  collapsed?: boolean;
  children: NavigationItemLink[];
  permission?: Permission;
};

type NavigationItem = NavigationItemLink | NavigationGroup | Divider;

type NavigationConfig = {
  items: NavigationItem[];
};

export type {
  NavigationItemLink,
  NavigationGroup,
  NavigationItem as NavigationConfigItem,
  NavigationConfig,
};

type CreateNavigationConfigArgs = {
  subscriptionTier?: SubscriptionTier;
  featureFlags?: Record<string, boolean>;
  userRole?: UserRole | string;  // User role for permission checks
};

const paths = configuration.paths.settings;

export function createNavigationConfig({
  subscriptionTier,
  featureFlags = configuration.features,
  userRole,
}: CreateNavigationConfigArgs): NavigationConfig {
  const context: PermissionContext = {
    subscriptionTier,
    featureFlags,
    userRole,
  };

  const items: NavigationItem[] = [
    {
      label: 'navigation:dashboard',
      path: '/dashboard',
      Icon: createIconRenderer('dashboard'),
      end: true,
    },
    {
      label: 'navigation:offers',
      path: '/offers',
      Icon: createIconRenderer('offers'),
    },
    {
      label: 'navigation:tasks',
      path: '/tasks',
      Icon: createIconRenderer('tasks'),
    },
    {
      label: 'navigation:adsCenter',
      path: '/adscenter',
      Icon: createIconRenderer('ads'),
      permission: {
        subscriptionTiers: ['pro', 'max', 'elite'],
      },
    },
    {
      divider: true,
    },
    {
      label: 'navigation:admin',
      path: '/manage',
      Icon: createIconRenderer('settings'),
      permission: {
        requiredRole: UserRole.Admin,  // Only admins can see this
      },
    },
    {
      label: 'navigation:settings.label',
      collapsible: false,
      children: [
        {
          label: 'navigation:settings.profile',
          path: paths.profile,
          Icon: createIconRenderer('profile'),
        },
        {
          label: 'navigation:settings.subscription',
          path: paths.subscription,
          Icon: createIconRenderer('billing'),
        },
      ],
    },
  ];

  return {
    items: filterNavigationItems(items, context),
  };
}

export function resolvePrimaryNavigationLinks(
  args: CreateNavigationConfigArgs,
) {
  const config = createNavigationConfig(args);

  const links: NavigationItemLink[] = [];

  config.items.forEach((item) => {
    if ('divider' in item) {
      return;
    }

    if ('children' in item) {
      item.children.forEach((child) => links.push(child));

      return;
    }

    links.push(item);
  });

  return links;
}

type PermissionContext = {
  subscriptionTier?: SubscriptionTier;
  featureFlags: Record<string, boolean>;
  userRole?: UserRole | string;
};

function filterNavigationItems(
  items: NavigationItem[],
  context: PermissionContext,
): NavigationItem[] {
  return items
    .map((item) => {
      if ('divider' in item) {
        return item;
      }

      if ('children' in item) {
        if (!isPermitted(item.permission, context)) {
          return null;
        }

        const filteredChildren = item.children.filter((child) =>
          isPermitted(child.permission, context),
        );

        if (filteredChildren.length === 0) {
          return null;
        }

        return {
          ...item,
          children: filteredChildren,
        };
      }

      return isPermitted(item.permission, context) ? item : null;
    })
    .filter(Boolean) as NavigationItem[];
}

function isPermitted(permission: Permission | undefined, context: PermissionContext) {
  if (!permission) {
    return true;
  }

  // Check feature flag
  if (
    permission.featureFlag &&
    !context.featureFlags?.[permission.featureFlag]
  ) {
    return false;
  }

  // Check subscription tier
  if (permission.subscriptionTiers && permission.subscriptionTiers.length > 0) {
    if (!context.subscriptionTier) {
      return false;
    }

    if (!permission.subscriptionTiers.includes(context.subscriptionTier)) {
      return false;
    }
  }

  // Check user role requirement
  if (permission.requiredRole) {
    const userRole = context.userRole;

    // No role provided - deny access
    if (!userRole) {
      return false;
    }

    // Admin role required - only allow if user is admin
    if (permission.requiredRole === UserRole.Admin) {
      return userRole === UserRole.Admin;
    }
  }

  return true;
}

export default createNavigationConfig;
