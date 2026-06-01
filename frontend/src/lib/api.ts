// ==========================================
// API Client - Connect to Backend API Gateway
// ==========================================

import {
  CART_UPDATED_EVENT,
  clearGuestCart,
  mergeGuestCartIntoUser,
} from "@/lib/cart";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_KEY = "techsphere_auth_token";
const USER_KEY = "techsphere_auth_user";
const ROLE_COOKIE_KEY = "auth_role";
const TOKEN_COOKIE_KEY = "auth_token";

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

type SaveAuthSessionOptions = {
  mergeGuestCart?: boolean;
};

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  if (!entry) return null;
  return decodeURIComponent(entry.slice(prefix.length));
}

function decodeJwtPayload(token: string) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = window.atob(normalized);
    return JSON.parse(decoded) as Partial<AuthUser>;
  } catch {
    return null;
  }
}

function normalizeNextPath(next?: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export function getDefaultRouteForRole(user: AuthUser) {
  return user.role === "ADMIN" ? "/admin" : "/";
}

export function resolvePostLoginPath(user: AuthUser, next?: string | null) {
  const normalizedNext = normalizeNextPath(next);

  if (user.role === "ADMIN") {
    return normalizedNext && normalizedNext.startsWith("/admin")
      ? normalizedNext
      : getDefaultRouteForRole(user);
  }

  if (!normalizedNext || normalizedNext === "/auth" || normalizedNext.startsWith("/admin")) {
    return getDefaultRouteForRole(user);
  }

  return normalizedNext;
}

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

export function saveAuthSession(
  auth: AuthResponse,
  options: SaveAuthSessionOptions = {},
) {
  if (typeof window === "undefined") return;
  if (options.mergeGuestCart) {
    mergeGuestCartIntoUser(auth.user.id);
  }
  window.localStorage.setItem(TOKEN_KEY, auth.accessToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  writeCookie(TOKEN_COOKIE_KEY, auth.accessToken, 60 * 60 * 24 * 30);
  writeCookie(ROLE_COOKIE_KEY, auth.user.role, 60 * 60 * 24 * 30);
  window.dispatchEvent(new Event("auth-changed"));
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  clearGuestCart();
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  clearCookie(TOKEN_COOKIE_KEY);
  clearCookie(ROLE_COOKIE_KEY);
  window.dispatchEvent(new Event("auth-changed"));
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function syncClientAuthState() {
  if (typeof window === "undefined") return null;

  const storedToken = window.localStorage.getItem(TOKEN_KEY);
  const storedUser = getStoredUser();
  const cookieToken = readCookie(TOKEN_COOKIE_KEY);
  const cookieRole = readCookie(ROLE_COOKIE_KEY);

  const hasCookieSession = Boolean(cookieToken && cookieRole);
  const hasStoredSession = Boolean(storedToken && storedUser);

  if (!hasCookieSession && hasStoredSession) {
    clearAuthSession();
    return null;
  }

  if (hasCookieSession && !hasStoredSession && cookieToken) {
    const payload = decodeJwtPayload(cookieToken);
    if (payload?.id && payload?.email && payload?.name && payload?.role) {
      const restoredUser: AuthUser = {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
      window.localStorage.setItem(TOKEN_KEY, cookieToken);
      window.localStorage.setItem(USER_KEY, JSON.stringify(restoredUser));
      return restoredUser;
    }
  }

  if (storedUser && cookieRole && storedUser.role !== cookieRole) {
    clearAuthSession();
    return null;
  }

  return storedUser;
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
    if (res.status === 401 && !path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/register")) {
      clearAuthSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
        window.location.href = `/auth?next=${encodeURIComponent(window.location.pathname)}`;
      }
    }
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
  forgotPassword: (email: string) =>
    fetchApi<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (payload: { token: string; password: string }) =>
    fetchApi<{ ok: boolean; message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
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
  orderCode?: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  shippingAddress: ShippingAddress;
  status: string;
  paymentMethod?: string;
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
  list: (all?: boolean) => fetchApi<Order[]>(`/api/orders${all ? "?all=true" : ""}`),
  get: (id: string) => fetchApi<Order>(`/api/orders/${id}`),
  updateStatus: (id: string, status: string, reason?: string) =>
    fetchApi<Order>(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),
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

export interface CatalogProduct {
  productId: string;
  productName: string;
  price?: number;
  category?: string;
  shortDescription?: string;
  description?: string;
  specs?: string[];
  accentClass?: string;
  rating?: number;
  sold?: number;
  warranty?: string;
  images?: string[];
}

export const inventoryApi = {
  list: () => fetchApi<InventoryItem[]>("/api/inventory"),
  get: (productId: string) => fetchApi<InventoryItem>(`/api/inventory/${productId}`),
  lowStock: () => fetchApi<InventoryItem[]>("/api/inventory/alerts/low-stock"),
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
  provider?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const paymentsApi = {
  list: () => fetchApi<Payment[]>("/api/payments"),
  get: (id: string) => fetchApi<Payment>(`/api/payments/${id}`),
  updateStatus: (id: string, payload: { status: string; reason?: string; transactionId?: string }) =>
    fetchApi<Payment>(`/api/payments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getByOrder: (orderId: string) => fetchApi<Payment>(`/api/payments/order/${orderId}`),
  sepayIntent: (payload: { orderId: string; customerId: string; amount: number }) =>
    fetchApi<{
      ok: boolean;
      payment: Payment;
      qrPayload: {
        provider: string;
        bankName: string;
        account: string;
        orderId: string;
        paymentId: string;
        amount: number;
        currency: string;
        method: string;
        template: string;
      };
      webhookUrl: string;
    }>("/api/payments/sepay/intent", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  sepaySimulate: (payload: { paymentId: string; status: "SUCCESS" | "FAILED" }) =>
    fetchApi<{ ok: boolean; result: unknown }>("/api/payments/sepay/simulate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ----- Shipments -----
export interface Shipment {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber?: string;
  status: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  shippingAddress?: ShippingAddress;
  createdAt: string;
  updatedAt: string;
}

export const shipmentsApi = {
  list: () => fetchApi<Shipment[]>("/api/shipments"),
  get: (id: string) => fetchApi<Shipment>(`/api/shipments/${id}`),
  updateStatus: (id: string, payload: { status: string; reason?: string; trackingNumber?: string }) =>
    fetchApi<Shipment>(`/api/shipments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
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
  isRead: boolean;
  sentAt?: string;
  createdAt: string;
}

export const notificationsApi = {
  list: () => fetchApi<NotificationItem[]>("/api/notifications"),
  get: (id: string) => fetchApi<NotificationItem>(`/api/notifications/${id}`),
  getByOrder: (orderId: string) => fetchApi<NotificationItem[]>(`/api/notifications/order/${orderId}`),
  read: (id: string) => fetchApi<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),
  updateStatus: (id: string, payload: { status: string; reason?: string }) =>
    fetchApi<NotificationItem>(`/api/notifications/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  resend: (id: string) =>
    fetchApi<{ ok: boolean; notification: NotificationItem }>(`/api/notifications/${id}/resend`, {
      method: "POST",
    }),
};

// ----- Admin Users -----
export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const usersApi = {
  list: () => fetchApi<AdminUserRecord[]>("/api/users"),
  get: (id: string) => fetchApi<AdminUserRecord>(`/api/users/${id}`),
  updateRole: (id: string, role: "USER" | "ADMIN") =>
    fetchApi<AdminUserRecord>(`/api/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  updateStatus: (id: string, payload: { status: string; reason?: string }) =>
    fetchApi<AdminUserRecord>(`/api/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
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

// ----- AI Chat -----
export interface AIChatPayload {
  session_id: string;
  message: string;
  cart_items?: any[];
}

export interface AgentAction {
  type: "ADD_TO_CART" | "NONE";
  productId?: string;
  productName?: string;
  quantity?: number;
  confirmMessage?: string;
}

export interface AIChatResponse {
  ok: boolean;
  bot_response: string;
  suggested_products: Array<{ productId: string; reason: string }>;
  agent_action?: AgentAction;
}

export const aiApi = {
  chat: (payload: AIChatPayload) =>
    fetchWithRefresh<AIChatResponse>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

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
