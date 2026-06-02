// ==========================================
// Event Types - Event-Driven Architecture
// ==========================================

// ----- Base Event -----
export interface BaseEvent {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  correlationId: string; // Track saga across services
  metadata?: Record<string, unknown>;
}

// ----- Order Events -----
export interface OrderPlacedEvent extends BaseEvent {
  type: "ORDER_PLACED";
  payload: {
    orderId: string;
    customerId: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }>;
    totalAmount: number;
    shippingAddress: {
      fullName: string;
      phone: string;
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
}

export interface OrderConfirmedEvent extends BaseEvent {
  type: "ORDER_CONFIRMED";
  payload: {
    orderId: string;
    customerId: string;
  };
}

export interface OrderCancelledEvent extends BaseEvent {
  type: "ORDER_CANCELLED";
  payload: {
    orderId: string;
    customerId: string;
    reason: string;
  };
}

export interface OrderCompletedEvent extends BaseEvent {
  type: "ORDER_COMPLETED";
  payload: {
    orderId: string;
    customerId: string;
    completedAt: string;
  };
}

// ----- Inventory Events -----
export interface StockReservedEvent extends BaseEvent {
  type: "STOCK_RESERVED";
  payload: {
    orderId: string;
    reservationId: string;
    items: Array<{
      productId: string;
      quantity: number;
    }>;
  };
}

export interface StockReservationFailedEvent extends BaseEvent {
  type: "STOCK_RESERVATION_FAILED";
  payload: {
    orderId: string;
    reason: string;
    failedItems: Array<{
      productId: string;
      requestedQuantity: number;
      availableQuantity: number;
    }>;
  };
}

export interface StockReleasedEvent extends BaseEvent {
  type: "STOCK_RELEASED";
  payload: {
    orderId: string;
    reservationId: string;
  };
}

export interface LowStockAlertEvent extends BaseEvent {
  type: "LOW_STOCK_ALERT";
  payload: {
    productId: string;
    productName: string;
    currentStock: number;
    threshold: number;
  };
}

export interface ProductCreatedEvent extends BaseEvent {
  type: "PRODUCT_CREATED";
  payload: {
    productId: string;
    productName: string;
    totalStock: number;
    availableStock: number;
    price?: number;
    category?: string;
    image?: string;
  };
}

export interface ProductUpdatedEvent extends BaseEvent {
  type: "PRODUCT_UPDATED";
  payload: {
    productId: string;
    productName: string;
    totalStock: number;
    availableStock: number;
    price?: number;
    category?: string;
    image?: string;
  };
}

export interface ProductDeletedEvent extends BaseEvent {
  type: "PRODUCT_DELETED";
  payload: {
    productId: string;
    productName: string;
  };
}

// ----- Payment Events -----
export interface PaymentProcessedEvent extends BaseEvent {
  type: "PAYMENT_PROCESSED";
  payload: {
    orderId: string;
    paymentId: string;
    amount: number;
    transactionId: string;
  };
}

export interface PaymentFailedEvent extends BaseEvent {
  type: "PAYMENT_FAILED";
  payload: {
    orderId: string;
    paymentId: string;
    reason: string;
    retryable: boolean;
  };
}

export interface PaymentRefundedEvent extends BaseEvent {
  type: "PAYMENT_REFUNDED";
  payload: {
    orderId: string;
    paymentId: string;
    refundAmount: number;
    reason: string;
  };
}

// ----- Shipping Events -----
export interface ShippingScheduledEvent extends BaseEvent {
  type: "SHIPPING_SCHEDULED";
  payload: {
    orderId: string;
    shipmentId: string;
    carrier: string;
    estimatedDelivery: string;
  };
}

export interface OrderShippedEvent extends BaseEvent {
  type: "ORDER_SHIPPED";
  payload: {
    orderId: string;
    shipmentId: string;
    trackingNumber: string;
  };
}

export interface OrderDeliveredEvent extends BaseEvent {
  type: "ORDER_DELIVERED";
  payload: {
    orderId: string;
    shipmentId: string;
    deliveredAt: string;
  };
}

export interface DeliveryFailedEvent extends BaseEvent {
  type: "DELIVERY_FAILED";
  payload: {
    orderId: string;
    shipmentId: string;
    reason: string;
  };
}

// ----- Notification Events -----
export interface NotificationSentEvent extends BaseEvent {
  type: "NOTIFICATION_SENT";
  payload: {
    orderId: string;
    notificationId: string;
    type: string;
    recipient: string;
  };
}

export interface NotificationFailedEvent extends BaseEvent {
  type: "NOTIFICATION_FAILED";
  payload: {
    orderId: string;
    notificationId: string;
    type: string;
    reason: string;
  };
}

// ----- Union Type of all events -----
export type DomainEvent =
  | OrderPlacedEvent
  | OrderConfirmedEvent
  | OrderCancelledEvent
  | OrderCompletedEvent
  | StockReservedEvent
  | StockReservationFailedEvent
  | StockReleasedEvent
  | LowStockAlertEvent
  | ProductCreatedEvent
  | ProductUpdatedEvent
  | ProductDeletedEvent
  | PaymentProcessedEvent
  | PaymentFailedEvent
  | PaymentRefundedEvent
  | ShippingScheduledEvent
  | OrderShippedEvent
  | OrderDeliveredEvent
  | DeliveryFailedEvent
  | NotificationSentEvent
  | NotificationFailedEvent;

// ----- Event Type Names -----
export type EventType = DomainEvent["type"];

// ----- All Event Channels/Topics -----
export const EVENT_CHANNELS = {
  ORDER_PLACED: "order.placed",
  ORDER_CONFIRMED: "order.confirmed",
  ORDER_CANCELLED: "order.cancelled",
  ORDER_COMPLETED: "order.completed",
  STOCK_RESERVED: "inventory.stock_reserved",
  STOCK_RESERVATION_FAILED: "inventory.stock_reservation_failed",
  STOCK_RELEASED: "inventory.stock_released",
  LOW_STOCK_ALERT: "inventory.low_stock_alert",
  PRODUCT_CREATED: "inventory.product_created",
  PRODUCT_UPDATED: "inventory.product_updated",
  PRODUCT_DELETED: "inventory.product_deleted",
  PAYMENT_PROCESSED: "payment.processed",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",
  SHIPPING_SCHEDULED: "shipping.scheduled",
  ORDER_SHIPPED: "shipping.shipped",
  ORDER_DELIVERED: "shipping.delivered",
  DELIVERY_FAILED: "shipping.delivery_failed",
  NOTIFICATION_SENT: "notification.sent",
  NOTIFICATION_FAILED: "notification.failed",
} as const;
