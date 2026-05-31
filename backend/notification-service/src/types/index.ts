// ==========================================
// Notification Service - Prisma Row Types
// ==========================================
// Extracted from inline type annotations for reusability.
// These types represent the raw rows returned by Prisma queries
// before they are mapped to the shared domain types.

/** Raw row returned by Prisma for the Notification model. */
export type NotificationRow = {
  id: string;
  orderId: string;
  customerId: string;
  type: string;
  subject: string;
  body: string;
  status: string;
  isRead: boolean;
  sentAt: Date | null;
  createdAt: Date;
};

/** Raw row returned by Prisma for the Event model. */
export type EventRow = {
  id: number;
  eventId: string;
  type: string;
  source: string;
  correlationId: string;
  payload: unknown;
  timestamp: Date;
  storedAt: Date;
};
