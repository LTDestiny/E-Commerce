// ==========================================
// Inventory Types
// ==========================================

export enum StockAction {
  RESERVE = "RESERVE",
  RELEASE = "RELEASE",
  DEDUCT = "DEDUCT",
  RESTOCK = "RESTOCK",
}

export interface InventoryItem {
  productId: string;
  productName: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export interface StockReservation {
  id: string;
  orderId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  status: "RESERVED" | "RELEASED" | "CONFIRMED";
  createdAt: string;
}

export interface ReserveStockRequest {
  orderId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}
