// ==========================================
// API Client - Connect to Backend API Gateway
// ==========================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || "API Error");
  }

  return res.json();
}

// ----- Orders -----
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
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderPayload {
  customerId: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
}

export const ordersApi = {
  create: (payload: CreateOrderPayload) =>
    fetchApi<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  list: () => fetchApi<Order[]>("/api/orders"),
  get: (id: string) => fetchApi<Order>(`/api/orders/${id}`),
  getEvents: (id: string) =>
    fetchApi<StoredEvent[]>(`/api/orders/${id}/events`),
  getStats: () => fetchApi<OrderStats>("/api/orders/stats"),
};

export interface OrderStats {
  total: number;
  byStatus: Record<string, number>;
  totalRevenue: number;
}

// ----- Inventory -----
export interface InventoryItem {
  productId: string;
  productName: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export const inventoryApi = {
  list: () => fetchApi<InventoryItem[]>("/api/inventory"),
  get: (productId: string) =>
    fetchApi<InventoryItem>(`/api/inventory/${productId}`),
};

// ----- Payments -----
export interface Payment {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export const paymentsApi = {
  list: () => fetchApi<Payment[]>("/api/payments"),
  getByOrder: (orderId: string) =>
    fetchApi<Payment>(`/api/payments/order/${orderId}`),
};

// ----- Shipments -----
export interface Shipment {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber?: string;
  status: string;
  estimatedDelivery?: string;
  createdAt: string;
  updatedAt: string;
}

export const shipmentsApi = {
  list: () => fetchApi<Shipment[]>("/api/shipments"),
  getByOrder: (orderId: string) =>
    fetchApi<Shipment>(`/api/shipments/order/${orderId}`),
};

// ----- Notifications -----
export interface NotificationItem {
  id: string;
  orderId: string;
  customerId: string;
  type: string;
  subject: string;
  body: string;
  status: string;
  sentAt?: string;
  createdAt: string;
}

export const notificationsApi = {
  list: () => fetchApi<NotificationItem[]>("/api/notifications"),
  getByOrder: (orderId: string) =>
    fetchApi<NotificationItem[]>(`/api/notifications/order/${orderId}`),
};

// ----- Health -----
export interface HealthStatus {
  gateway: string;
  status: string;
  sseClients: number;
  timestamp: string;
  services: Array<{
    name: string;
    url: string;
    status: string;
    data?: { service: string; status: string; uptime: number };
  }>;
}

export const healthApi = {
  check: () => fetchApi<HealthStatus>("/api/health"),
};

// ----- Events -----
export interface StoredEvent {
  sequenceNumber: number;
  event: {
    id: string;
    type: string;
    source: string;
    timestamp: string;
    correlationId: string;
    payload: Record<string, unknown>;
  };
  storedAt: string;
}

// ----- SSE Event Stream -----
export function createEventStream(
  onEvent: (event: Record<string, unknown>) => void,
  onError?: (error: Event) => void,
): EventSource {
  const eventSource = new EventSource(`${API_BASE}/api/events/stream`);

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
    } catch {
      // ignore parse errors
    }
  };

  eventSource.onerror = (e) => {
    onError?.(e);
  };

  return eventSource;
}
