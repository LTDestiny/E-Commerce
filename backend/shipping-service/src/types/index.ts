// ==========================================
// Shipping Service - Prisma Row Types
// ==========================================
// Extracted from inline type annotations for reusability.
// These types represent the raw rows returned by Prisma queries
// before they are mapped to the shared domain types.

/** Raw row returned by Prisma for the Shipment model. */
export type ShipmentRow = {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber: string | null;
  status: string;
  estimatedDelivery: Date | null;
  actualDelivery: Date | null;
  shippingAddress: unknown;
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
