// ==========================================
// Order Types
// ==========================================

export enum OrderStatus {
  PENDING = "PENDING",
  INVENTORY_RESERVED = "INVENTORY_RESERVED",
  PAYMENT_PROCESSING = "PAYMENT_PROCESSING",
  PAYMENT_COMPLETED = "PAYMENT_COMPLETED",
  CONFIRMED = "CONFIRMED",
  SHIPPING_SCHEDULED = "SHIPPING_SCHEDULED",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  shippingAddress: ShippingAddress;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  customerId: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
}
