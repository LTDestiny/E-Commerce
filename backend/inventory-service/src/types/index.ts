// ==========================================
// Inventory Service - Prisma Row Types
// ==========================================
// Extracted from inline type annotations for reusability.
// These types represent the raw rows returned by Prisma queries
// before they are mapped to the shared domain types.

/** Raw row returned by Prisma for the InventoryItem model. */
export type InventoryItemRow = {
  productId: string;
  productName: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  lowStockThreshold: number;
  updatedAt: Date;
  price?: number | null;
  category?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  specs?: any | null;
  accentClass?: string | null;
  rating?: number | null;
  sold?: number | null;
  warranty?: string | null;
  image?: string | null;
};

/** Raw row returned by Prisma for the StockReservation model. */
export type StockReservationRow = {
  id: string;
  orderId: string;
  items: unknown;
  status: string;
  createdAt: Date;
};

/** Item that failed stock reservation check. */
export type FailedStockItem = {
  productId: string;
  requestedQuantity: number;
  availableQuantity: number;
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
