// ==========================================
// Payment Service - Prisma Row Types
// ==========================================
// Extracted from inline type annotations for reusability.
// These types represent the raw rows returned by Prisma queries
// before they are mapped to the shared domain types.

/** Raw row returned by Prisma for the Payment model. */
export type PaymentRow = {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  transactionId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
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
