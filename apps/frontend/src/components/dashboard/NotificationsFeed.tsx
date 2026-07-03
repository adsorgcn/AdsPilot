'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import { Button } from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { ScrollArea } from '~/core/ui/ScrollArea';
import { useRequireAuth } from '~/core/hooks/useRequireAuth';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  AlertCircle,
  TrendingUp,
  Eye,
  MoreHorizontal,
  Bell
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

interface NotificationsFeedProps {
  maxItems?: number;
  className?: string;
}

interface NotificationItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: Date;
  metadata?: {
    offerId?: string;
    score?: number;
    brandName?: string;
    domain?: string;
    tokens?: number;
  };
  read?: boolean;
}

export function NotificationsFeed({ maxItems = 10, className }: NotificationsFeedProps) {
  const { t } = useTranslation();
  const user = useRequireAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    // Set up SSE for real-time updates
    setupEventStream();

    return () => {
      // Cleanup SSE connection
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get auth token
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Fetch recent notifications from useractivity service
      const response = await fetch('/api/v1/notifications/recent', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }

      const data = await response.json();
      const notificationItems: NotificationItem[] = data.items.map((notif: Notification) => {
        // Parse message to extract metadata
        let metadata: any = {};
        try {
          const messageData = JSON.parse(notif.message);
          metadata = messageData;
        } catch {
          // Keep message as description if it's not JSON
        }

        return {
          id: notif.id,
          type: mapNotificationType(notif.type),
          title: notif.title,
          description: typeof metadata.message === 'string' ? metadata.message : notif.message,
          timestamp: new Date(notif.createdAt),
          metadata: {
            offerId: metadata.offerId,
            score: metadata.aiScore,
            brandName: metadata.brandName,
            domain: metadata.domain,
            tokens: metadata.tokensConsumed,
          },
        };
      });

      // Sort by timestamp (newest first) and limit
      notificationItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setNotifications(notificationItems.slice(0, maxItems));

      // Fetch unread count
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const response = await fetch('/api/v1/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (err) {
      console.warn('Failed to fetch unread count:', err);
    }
  };

  const setupEventStream = () => {
    try {
      const tokenPromise = user?.getIdToken();
      if (!tokenPromise) return;

      tokenPromise.then(token => {
        if (!token) return;

        // EventSource doesn't support custom headers, pass token in URL
        const eventSource = new EventSource(`/api/v1/notifications/stream?token=${encodeURIComponent(token)}`);

        eventSource.onmessage = (event) => {
          if (event.type === 'unread') {
            const data = JSON.parse(event.data);
            setUnreadCount(data.count);
          } else if (event.type === 'new') {
            // New notification received
            fetchNotifications();
          }
        };

        eventSource.onerror = () => {
          console.warn('Notification stream connection error');
        };

        return () => {
          eventSource.close();
        };
      });
    } catch (err) {
      console.warn('Failed to setup notification stream:', err);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      await fetch('/api/v1/notifications/read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lastId: notificationId }),
      });

      // Update unread count
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      await fetch(`/api/v1/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Refresh notifications
      fetchNotifications();
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const mapNotificationType = (type: string): NotificationItem['type'] => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('success') || lowerType.includes('completed')) {
      return 'success';
    }
    if (lowerType.includes('error') || lowerType.includes('failed')) {
      return 'error';
    }
    if (lowerType.includes('warning') || lowerType.includes('risk')) {
      return 'warning';
    }
    return 'info';
  };

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'info':
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('dashboard.notifications.time.now', 'Just now');
    if (diffMins < 60) return t('dashboard.notifications.time.minutesAgo', `${diffMins}m ago`);
    if (diffHours < 24) return t('dashboard.notifications.time.hoursAgo', `${diffHours}h ago`);
    if (diffDays < 7) return t('dashboard.notifications.time.daysAgo', `${diffDays}d ago`);
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('dashboard.notifications.title', 'Recent Activity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-red-600 mb-2" />
              <p className="text-sm text-red-600 mb-2">
                {t('dashboard.notifications.error', 'Failed to load notifications')}
              </p>
              <p className="text-xs text-muted-foreground">
                {error}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchNotifications}
                className="mt-3"
              >
                {t('dashboard.notifications.retry', 'Retry')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('dashboard.notifications.title', 'Recent Activity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">
              {t('dashboard.notifications.loading', 'Loading activity...')}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t('dashboard.notifications.title', 'Recent Activity')}
        </CardTitle>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge variant="destructive">
              {unreadCount} {t('dashboard.notifications.unread', 'new')}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchNotifications}
            className="h-8 w-8 p-0"
          >
            <TrendingUp className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-80">
          <div className="p-4 space-y-4">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.notifications.noActivity', 'No recent notifications')}
                  </p>
                </div>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium leading-none">
                          {notification.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {notification.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                          {notification.metadata?.score && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              {notification.metadata.score}/100
                            </Badge>
                          )}
                          {notification.metadata?.tokens && (
                            <Badge variant="outline" className="text-xs">
                              {notification.metadata.tokens} tokens
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {notification.metadata?.offerId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              window.location.href = `/offers/${notification.metadata?.offerId}`;
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}