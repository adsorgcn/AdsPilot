'use client';

import If from '~/core/ui/If';
import { useConsoleRecentActivity } from '~/lib/admin/resources/dashboard';
import {
  UserPlusIcon,
  CreditCardIcon,
  RocketLaunchIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export default function RecentActivityFeed() {
  const {
    data,
    error,
    isLoading,
  } = useConsoleRecentActivity();

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : 'Failed to load activity'
    : null;

  const loading = isLoading && !data;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_registered':
        return <UserPlusIcon className="h-5 w-5 text-blue-500" />;
      case 'subscription_created':
        return <CreditCardIcon className="h-5 w-5 text-green-500" />;
      case 'offer_deployed':
        return <RocketLaunchIcon className="h-5 w-5 text-purple-500" />;
      case 'system_alert':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <div className="h-2 w-2 rounded-full bg-gray-400" />;
    }
  };

  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case 'error':
        return <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">Error</span>;
      case 'warning':
        return <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">Warning</span>;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (errorMessage) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-800">Failed to load activity: {errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-6">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        <p className="text-sm text-muted-foreground">
          Latest platform events and user actions
        </p>
      </div>

      <div className="divide-y">
        <If condition={loading}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-4 p-6">
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </If>

        <If condition={!loading && (!data?.activities || data.activities.length === 0)}>
          <div className="p-12 text-center text-sm text-muted-foreground">
            No recent activity
          </div>
        </If>

        <If condition={!loading && !!data?.activities && data.activities.length > 0}>
          {data?.activities.map((activity: import('~/lib/api/types/console').RecentActivity) => (
            <div key={activity.id} className="flex items-start gap-4 p-6 transition-colors hover:bg-muted/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-medium">{activity.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                    {activity.userEmail && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {activity.userEmail}
                      </p>
                    )}
                  </div>
                  {getSeverityBadge(activity.severity)}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatTimestamp(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </If>
      </div>

      <If condition={!loading && !!data?.activities && data.activities.length > 0}>
        <div className="border-t bg-muted/50 px-6 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            Showing {data?.total ?? 0} recent activities • Updates every 30s
          </p>
        </div>
      </If>
    </div>
  );
}
