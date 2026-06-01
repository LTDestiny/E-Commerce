// ==========================================
// Notification Types
// ==========================================

export enum NotificationType {
  EMAIL = "EMAIL",
  SMS = "SMS",
  PUSH = "PUSH",
  IN_APP = "IN_APP",
}

export enum NotificationStatus {
  QUEUED = "QUEUED",
  PENDING = "PENDING",
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export interface Notification {
  id: string;
  orderId: string;
  customerId: string;
  type: NotificationType;
  subject: string;
  body: string;
  status: NotificationStatus;
  isRead?: boolean;
  sentAt?: string;
  createdAt: string;
}

export interface SendNotificationRequest {
  orderId: string;
  customerId: string;
  type: NotificationType;
  subject: string;
  body: string;
}
