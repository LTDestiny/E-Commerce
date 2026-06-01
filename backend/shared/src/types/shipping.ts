// ==========================================
// Shipping Types
// ==========================================

export enum ShippingStatus {
  PENDING = "PENDING",
  READY = "READY",
  IN_TRANSIT = "IN_TRANSIT",
  DELAYED = "DELAYED",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum ShippingCarrier {
  GIAO_HANG_NHANH = "GIAO_HANG_NHANH",
  GIAO_HANG_TIET_KIEM = "GIAO_HANG_TIET_KIEM",
  VIETTEL_POST = "VIETTEL_POST",
  J_AND_T = "J_AND_T",
  SHOPEE_EXPRESS = "SHOPEE_EXPRESS",
}

export interface Shipment {
  id: string;
  orderId: string;
  carrier: ShippingCarrier;
  trackingNumber?: string;
  status: ShippingStatus;
  estimatedDelivery?: string;
  actualDelivery?: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleShippingRequest {
  orderId: string;
  carrier?: ShippingCarrier;
}
