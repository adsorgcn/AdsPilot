export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  next?: string;
}
