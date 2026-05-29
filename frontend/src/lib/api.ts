// ==========================================
// API Client - Connect to Backend API Gateway
// ==========================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_KEY = "techsphere_auth_token";
const USER_KEY = "techsphere_auth_user";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveAuthSession(auth: AuthResponse) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, auth.accessToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`${res.status} ${path}: ${error.error || "API Error"}`);
  }

  return res.json();
}

async function fetchWithRefresh<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    return await fetchApi<T>(path, options);
  } catch (error) {
    if (error instanceof Error && error.message.includes("expired")) {
      const refreshed = await authApi.refresh();
      saveAuthSession(refreshed);
      return fetchApi<T>(path, options);
    }
    throw error;
  }
}

export const authApi = {
  register: (payload: { name: string; email: string; password: string }) =>
    fetchApi<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    fetchApi<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => fetchWithRefresh<{ user: AuthUser }>("/api/auth/me"),
  refresh: () => fetchApi<AuthResponse>("/api/auth/refresh", { method: "POST" }),
  logout: () => fetchApi<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
};

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
  getEvents: (id: string) => fetchApi<StoredEvent[]>(`/api/orders/${id}/events`),
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
  get: (productId: string) => fetchApi<InventoryItem>(`/api/inventory/${productId}`),
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
  getByOrder: (orderId: string) => fetchApi<Payment>(`/api/payments/order/${orderId}`),
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
  getByOrder: (orderId: string) => fetchApi<Shipment>(`/api/shipments/order/${orderId}`),
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
  getByOrder: (orderId: string) => fetchApi<NotificationItem[]>(`/api/notifications/order/${orderId}`),
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
