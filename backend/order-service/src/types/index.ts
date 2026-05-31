// ==========================================
// Order Service - Prisma Row Types
// ==========================================
// Extracted from inline type annotations for reusability.
// These types represent the raw rows returned by Prisma queries
// before they are mapped to the shared domain types.

/** Raw row returned by Prisma for the Order model. */
export type OrderRow = {
  id: string;
  orderCode: string;
  customerId: string;
  items: unknown;
  totalAmount: number;
  shippingAddress: unknown;
  status: string;
  paymentMethod: string;
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
