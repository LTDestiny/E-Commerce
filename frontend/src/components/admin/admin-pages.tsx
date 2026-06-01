"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Box,
  Check,
  CheckCircle2,
  ClipboardEdit,
  CreditCard,
  Mail,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";
import {
  createEventStream,
  healthApi,
  inventoryApi,
  notificationsApi,
  ordersApi,
  paymentsApi,
  shipmentsApi,
  usersApi,
  type AdminUserRecord,
  type HealthStatus,
  type InventoryItem,
  type NotificationItem,
  type Order,
  type Payment,
  type Shipment,
  type ShippingAddress,
  type StoredEvent,
} from "@/lib/api";
import { getStatusHistory } from "@/lib/admin/status/status-history";
import { cn } from "@/lib/utils";
import {
  StatusBadge,
  StatusHistoryTimeline,
  StatusPolicyHint,
  StatusTransitionMenu,
} from "@/components/admin/status-controls";

type AdminData = {
  orders: Order[];
  inventory: InventoryItem[];
  payments: Payment[];
  shipments: Shipment[];
  notifications: NotificationItem[];
  users: AdminUserRecord[];
  health: HealthStatus | null;
};

type LoadState = {
  data: AdminData;
  loading: boolean;
  error: string | null;
  reload: (silent?: boolean) => Promise<void>;
};

const emptyData: AdminData = {
  orders: [],
  inventory: [],
  payments: [],
  shipments: [],
  notifications: [],
  users: [],
  health: null,
};

function useAdminData(): LoadState {
  const [data, setData] = useState<AdminData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    const [orders, inventory, payments, shipments, notifications, users, health] =
      await Promise.allSettled([
        ordersApi.list(true),
        inventoryApi.list(),
        paymentsApi.list(),
        shipmentsApi.list(),
        notificationsApi.list(),
        usersApi.list(),
        healthApi.check(),
      ]);

    const nextData: AdminData = {
      orders: orders.status === "fulfilled" ? orders.value : [],
      inventory: inventory.status === "fulfilled" ? inventory.value : [],
      payments: payments.status === "fulfilled" ? payments.value : [],
      shipments: shipments.status === "fulfilled" ? shipments.value : [],
      notifications: notifications.status === "fulfilled" ? notifications.value : [],
      users: users.status === "fulfilled" ? users.value : [],
      health: health.status === "fulfilled" ? health.value : null,
    };

    if (orders.status === "rejected" && !silent) {
      setError("Khong tai duoc du lieu admin. Hay kiem tra token admin va backend.");
    }

    setData(nextData);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void reload());
  }, [reload]);

  useEffect(() => {
    const es = createEventStream(
      (event) => {
        if (event && event.type !== "CONNECTED") {
          void reload(true);
        }
      },
      () => {}
    );
    return () => {
      es.close();
    };
  }, [reload]);

  return { data, loading, error, reload };
}

function money(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function compactMoney(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value || 0));
}

function dateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function orderLabel(order: Order) {
  return order.orderCode || `#TS-${order.id.slice(0, 6).toUpperCase()}`;
}

function getCustomerName(order: Order, users: AdminUserRecord[]) {
  return users.find((user) => user.id === order.customerId)?.name || getOrderAddress(order).fullName || "Customer";
}

function getCustomerEmail(order: Order, users: AdminUserRecord[]) {
  return users.find((user) => user.id === order.customerId)?.email || `${order.customerId.slice(0, 8)}@customer.local`;
}

function getOrderItems(order: Order): Order["items"] {
  return Array.isArray(order.items) ? order.items : [];
}

function getOrderAddress(order: Order): ShippingAddress {
  return order.shippingAddress || {
    fullName: "Customer",
    phone: "N/A",
    street: "Address pending",
    city: "N/A",
    state: "",
    zipCode: "",
    country: "N/A",
  };
}

function getAvailable(item: InventoryItem) {
  return item.availableStock ?? item.totalStock - item.reservedStock;
}

function getOrderById(orders: Order[], orderId: string) {
  return orders.find((order) => order.id === orderId);
}

function isOrderFlowConsistent(order: Order, payment?: Payment, shipment?: Shipment) {
  const paymentStatus = payment?.status?.toUpperCase();
  const shipmentStatus = shipment?.status?.toUpperCase();

  const expected: Record<string, { payments: string[]; shipments: string[] }> = {
    PENDING: { payments: ["PENDING"], shipments: ["PENDING"] },
    CONFIRMED: { payments: ["COMPLETED"], shipments: ["PENDING", "READY"] },
    PROCESSING: { payments: ["COMPLETED"], shipments: ["READY", "IN_TRANSIT", "DELAYED"] },
    COMPLETED: { payments: ["COMPLETED"], shipments: ["DELIVERED"] },
    FAILED: { payments: ["FAILED"], shipments: ["FAILED", "CANCELLED"] },
    CANCELLED: { payments: ["CANCELLED", "REFUNDED"], shipments: ["CANCELLED"] },
  };

  const rule = expected[order.status.toUpperCase()];
  if (!rule) return false;
  return rule.payments.includes(paymentStatus || "") && rule.shipments.includes(shipmentStatus || "");
}

function productStatus(item: InventoryItem) {
  const available = getAvailable(item);
  if (available <= 0) return { label: "Out of Stock", tone: "bg-red-100 text-red-700" };
  if (available <= item.lowStockThreshold) return { label: "Low Stock", tone: "bg-amber-100 text-amber-800" };
  return { label: "In Stock", tone: "bg-emerald-100 text-emerald-800" };
}

function AdminPageFrame({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1480px] space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
          <p className="mt-1 text-base text-zinc-600">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function LoadingBlock({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-300 bg-white p-5 text-sm text-zinc-600">
        Dang nap du lieu admin...
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
        {error}
      </div>
    );
  }
  return null;
}

function StatCard({
  icon,
  label,
  value,
  tone = "blue",
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "blue" | "green" | "red" | "amber" | "neutral";
  note?: string;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    neutral: "bg-[#ebe9f3] text-zinc-900",
  };
  return (
    <div className="rounded-xl border border-zinc-300 bg-white p-6">
      <div className="flex items-start justify-between">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-md", tones[tone])}>
          {icon}
        </div>
        {note ? <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{note}</span> : null}
      </div>
      <div className="mt-5 text-sm font-medium uppercase tracking-[0.08em] text-zinc-600">{label}</div>
      <div className="mt-1 text-4xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em]", className)}>
      {children}
    </span>
  );
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-40 items-end gap-2 rounded-lg bg-[linear-gradient(90deg,rgba(15,23,42,.04)_1px,transparent_1px),linear-gradient(rgba(15,23,42,.04)_1px,transparent_1px)] bg-[length:44px_44px] p-6">
      {values.map((value, index) => (
        <div
          key={`${value}-${index}`}
          className={cn("flex-1 rounded-t", index === values.length - 3 ? "bg-blue-700" : "bg-blue-200")}
          style={{ height: `${Math.max(16, (value / max) * 120)}px` }}
        />
      ))}
    </div>
  );
}

export function AdminDashboardPage() {
  const { data, loading, error } = useAdminData();
  const revenue = data.payments
    .filter((payment) => payment.status.toUpperCase() === "COMPLETED")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const failedPayments = data.payments.filter((payment) => payment.status.toUpperCase() === "FAILED").length;
  const delayedShipments = data.shipments.filter((shipment) => shipment.status.toUpperCase() === "DELAYED").length;
  const lowStock = data.inventory.filter((item) => getAvailable(item) <= item.lowStockThreshold);
  const completedOrders = data.orders.filter((order) => order.status.toUpperCase() === "COMPLETED").length;
  const processingOrders = data.orders.filter((order) => order.status.toUpperCase() === "PROCESSING").length;
  const pendingOrders = data.orders.filter((order) => order.status.toUpperCase() === "PENDING").length;

  return (
    <AdminPageFrame
      title="Operations Dashboard"
      subtitle="Real-time performance metrics and system health monitoring."
    >
      <LoadingBlock loading={loading} error={error} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={<CreditCard className="h-6 w-6" />} label="Total Revenue" value={compactMoney(revenue)} note="+12%" />
        <StatCard icon={<ShoppingIcon />} label="Total Orders" value={String(data.orders.length)} note="+5%" />
        <StatCard icon={<Truck className="h-6 w-6" />} label="Delayed Shipments" value={String(delayedShipments)} tone="amber" />
        <StatCard icon={<AlertTriangle className="h-6 w-6" />} label="Failed Payments" value={String(failedPayments)} tone="red" />
        <StatCard icon={<ClipboardEdit className="h-6 w-6" />} label="Low Stock Items" value={String(lowStock.length)} tone="neutral" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="rounded-xl border border-zinc-300 bg-white p-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Revenue vs Orders Trend</h2>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-700" />Revenue</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-zinc-300" />Orders</span>
            </div>
          </div>
          <div className="mt-8">
            <MiniBars values={[revenue * 0.4, revenue * 0.62, revenue * 0.72, revenue, revenue * 0.6, revenue * 0.5, revenue * 0.66]} />
          </div>
        </section>

        <section className="rounded-xl border border-zinc-300 bg-white p-7">
          <h2 className="text-xl font-black">Order Distribution</h2>
          <div className="mx-auto mt-8 flex h-56 w-56 items-center justify-center rounded-2xl border-[18px] border-blue-700 bg-white shadow-inner">
            <div className="text-center">
              <div className="text-4xl font-black">{data.orders.length}</div>
              <div className="text-xs font-black uppercase tracking-[0.16em]">Total Vol</div>
            </div>
          </div>
          <div className="mt-8 space-y-4 text-sm">
            <MetricRow label="Completed" value={`${Math.round((completedOrders / Math.max(1, data.orders.length)) * 100)}%`} dot="bg-blue-700" />
            <MetricRow label="Processing" value={`${Math.round((processingOrders / Math.max(1, data.orders.length)) * 100)}%`} dot="bg-emerald-500" />
            <MetricRow label="Pending" value={`${Math.round((pendingOrders / Math.max(1, data.orders.length)) * 100)}%`} dot="bg-amber-500" />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-zinc-300 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-300 bg-[#f1eff8] px-6 py-4">
            <h2 className="text-xl font-black">Activity Feed</h2>
            <Link href="/admin/audit-logs" className="text-sm font-bold text-blue-700">View All</Link>
          </div>
          <div className="divide-y divide-zinc-200 p-6">
            {data.orders.slice(0, 4).map((order) => (
              <div key={order.id} className="flex gap-4 py-4">
                <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p>Order <b>{orderLabel(order)}</b> updated to <b>{order.status}</b>.</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">{dateTime(order.updatedAt)} · Order Service</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-300 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-300 bg-[#f1eff8] px-6 py-4">
            <h2 className="text-xl font-black">Low Stock Alert</h2>
            <Badge className="bg-red-100 text-red-700">{lowStock.length} Critical</Badge>
          </div>
          <InventoryTable items={lowStock.slice(0, 4)} compact />
        </section>
      </div>
    </AdminPageFrame>
  );
}

function ShoppingIcon() {
  return <Package className="h-6 w-6" />;
}

function MetricRow({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-full", dot)} />{label}</span>
      <span>{value}</span>
    </div>
  );
}

function AdminSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = options.find((option) => option.value === value)?.label || value;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-700">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className="mt-2 flex h-11 w-full items-center justify-between rounded-md border border-zinc-300 bg-[#f3f1fa] px-4 text-left text-sm"
      >
        {current}
        <span className="text-zinc-500">v</span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[72px] z-40 rounded-lg border border-zinc-300 bg-white p-1 shadow-2xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn("block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#f3f1fa]", value === option.value ? "font-black text-blue-700" : "")}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminOrdersPage() {
  const { data, loading, error, reload } = useAdminData();
  const [tab, setTab] = useState<"all" | "pending" | "flagged">("all");
  const [status, setStatus] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt-desc");

  const filteredOrders = useMemo(() => {
    let rows = [...data.orders];
    if (tab === "pending") rows = rows.filter((order) => order.status.includes("PENDING"));
    if (tab === "flagged") rows = rows.filter((order) => ["FAILED", "CANCELLED"].includes(order.status));
    if (status !== "all") rows = rows.filter((order) => order.status === status);
    if (paymentMethod !== "all") rows = rows.filter((order) => (order.paymentMethod || "SEPAY_QR") === paymentMethod);
    rows.sort((a, b) => {
      if (sortBy === "totalAmount-desc") return b.totalAmount - a.totalAmount;
      if (sortBy === "totalAmount-asc") return a.totalAmount - b.totalAmount;
      if (sortBy === "status-asc") return a.status.localeCompare(b.status);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return rows;
  }, [data.orders, paymentMethod, sortBy, status, tab]);

  const pendingCount = data.orders.filter((order) => order.status.includes("PENDING")).length;
  const flaggedCount = data.orders.filter((order) => ["FAILED", "CANCELLED"].includes(order.status)).length;
  const statusOptions = [
    { label: "All Statuses", value: "all" },
    ...Array.from(new Set(data.orders.map((order) => order.status))).map((value) => ({ label: value, value })),
  ];
  const paymentOptions = [
    { label: "Any Method", value: "all" },
    ...Array.from(new Set(data.orders.map((order) => order.paymentMethod || "SEPAY_QR"))).map((value) => ({ label: value, value })),
  ];
  const resetFilters = () => {
    setTab("all");
    setStatus("all");
    setPaymentMethod("all");
    setSortBy("createdAt-desc");
  };

  return (
    <AdminPageFrame
      title="Order Management"
      subtitle={`Reviewing ${filteredOrders.length} of ${data.orders.length} total platform orders`}
    >
      <LoadingBlock loading={loading} error={error} />
      <section className="rounded-xl border border-zinc-300 bg-white">
        <div className="flex gap-8 border-b border-zinc-300 px-6">
          {[
            { id: "all", label: "All Orders", count: data.orders.length },
            { id: "pending", label: "Pending", count: pendingCount },
            { id: "flagged", label: "Flagged", count: flaggedCount },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as typeof tab)}
              className={cn("border-b-2 px-2 py-5 text-sm font-semibold", tab === item.id ? "border-blue-700 text-blue-700" : "border-transparent")}
            >
              {item.label}
              {item.id !== "all" ? <span className="ml-2 rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">{item.count}</span> : null}
            </button>
          ))}
        </div>
        <div className="grid min-h-[96px] gap-4 border-b border-zinc-300 p-5 md:grid-cols-4">
          <AdminSelect label="Status" value={status} options={statusOptions} onChange={setStatus} />
          <AdminSelect label="Payment Method" value={paymentMethod} options={paymentOptions} onChange={setPaymentMethod} />
          <AdminSelect
            label="Sort"
            value={sortBy}
            options={[
              { label: "Created newest", value: "createdAt-desc" },
              { label: "Total high to low", value: "totalAmount-desc" },
              { label: "Total low to high", value: "totalAmount-asc" },
              { label: "Status A-Z", value: "status-asc" },
            ]}
            onChange={setSortBy}
          />
          <button onClick={resetFilters} className="mt-5 h-11 rounded-md bg-[#e7e4ef] px-4 text-sm font-semibold md:mt-6">Reset Filters</button>
        </div>
        <OrdersTable orders={filteredOrders} users={data.users} onChanged={reload} />
      </section>
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard icon={<CheckCircle2 className="h-6 w-6" />} label="Revenue Growth" value="+24.8%" tone="blue" />
        <StatCard icon={<RefreshCw className="h-6 w-6" />} label="Avg Processing Time" value="1.2 Days" tone="amber" />
        <StatCard icon={<ShieldCheck className="h-6 w-6" />} label="Delivery Success" value="99.4%" tone="green" />
      </div>
    </AdminPageFrame>
  );
}

function OrdersTable({ orders, users, onChanged }: { orders: Order[]; users: AdminUserRecord[]; onChanged?: () => Promise<void> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-[#f0edf8] text-xs font-black uppercase tracking-[0.12em]">
          <tr>
            <th className="px-6 py-4">Order ID</th>
            <th className="px-6 py-4">Customer</th>
            <th className="px-6 py-4">Items</th>
            <th className="px-6 py-4">Total</th>
            <th className="px-6 py-4">Payment</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-300">
          {orders.slice(0, 10).map((order) => (
            <tr key={order.id} className="hover:bg-[#fbfaff]">
              <td className="px-6 py-5 font-black text-blue-700">
                <Link href={`/admin/orders/${order.id}`}>{orderLabel(order)}</Link>
              </td>
              <td className="px-6 py-5">
                <div className="font-bold">{getCustomerName(order, users)}</div>
                <div className="text-xs text-zinc-500">{getCustomerEmail(order, users)}</div>
              </td>
              <td className="px-6 py-5">{getOrderItems(order).reduce((sum, item) => sum + item.quantity, 0)} Units</td>
              <td className="px-6 py-5 font-black">{money(order.totalAmount)}</td>
              <td className="px-6 py-5">{order.paymentMethod || "SEPAY_QR"}</td>
              <td className="px-6 py-5"><StatusBadge entityType="order" status={order.status} /></td>
              <td className="px-6 py-5">
                <StatusTransitionMenu
                  entityType="order"
                  entityId={order.id}
                  entityLabel={orderLabel(order)}
                  status={order.status}
                  onChanged={onChanged}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminOrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    const [orderResult, paymentResult, shipmentResult, notificationResult, eventResult] =
      await Promise.allSettled([
        ordersApi.get(orderId),
        paymentsApi.getByOrder(orderId),
        shipmentsApi.getByOrder(orderId),
        notificationsApi.getByOrder(orderId),
        ordersApi.getEvents(orderId),
      ]);
    setOrder(orderResult.status === "fulfilled" ? orderResult.value : null);
    if (orderResult.status === "rejected" && !silent) {
      setLoadError(orderResult.reason?.message || "Khong tai duoc don hang.");
    }
    setPayment(paymentResult.status === "fulfilled" ? paymentResult.value : null);
    setShipment(shipmentResult.status === "fulfilled" ? shipmentResult.value : null);
    setNotifications(notificationResult.status === "fulfilled" ? notificationResult.value : []);
    setEvents(eventResult.status === "fulfilled" ? eventResult.value : []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    const es = createEventStream(
      (event) => {
        if (event && event.type !== "CONNECTED") {
          void load(true);
        }
      },
      () => {}
    );
    return () => {
      es.close();
    };
  }, [load]);

  const resendEmail = async () => {
    const notification = notifications[0];
    if (!notification) {
      setMessage("Don hang chua co notification de gui lai.");
      return;
    }
    await notificationsApi.resend(notification.id);
    setMessage("Da gui lai email/thong bao thanh cong.");
    await load();
  };

  if (loading) return <LoadingBlock loading error={null} />;
  if (!order) return <LoadingBlock loading={false} error={loadError || "Khong tim thay don hang."} />;

  const orderItems = getOrderItems(order);
  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingFee = Math.max(0, order.totalAmount - subtotal);
  const customer = getOrderAddress(order);

  return (
    <AdminPageFrame
      title={`Order ${orderLabel(order)}`}
      subtitle={`Placed on ${dateTime(order.createdAt)} via ${order.paymentMethod || "SEPAY_QR"}`}
      actions={
        <>
          <StatusBadge entityType="order" status={order.status} className="self-center" />
          <StatusTransitionMenu
            entityType="order"
            entityId={order.id}
            entityLabel={orderLabel(order)}
            status={order.status}
            onChanged={load}
          />
          <button className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 font-semibold"><ClipboardEdit className="h-4 w-4" /> Edit Address</button>
          <button onClick={resendEmail} className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 font-semibold"><Mail className="h-4 w-4" /> Resend Email</button>
          <button className="inline-flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 font-semibold text-red-700"><RefreshCw className="h-4 w-4" /> Refund Order</button>
        </>
      }
    >
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-zinc-300 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-300 px-7 py-5">
              <h2 className="text-xl font-black">Order Items</h2>
              <span className="rounded bg-[#f0edf8] px-3 py-2 font-semibold">{orderItems.length} Items Total</span>
            </div>
            <div className="divide-y divide-zinc-300">
              {orderItems.map((item) => (
                <div key={`${item.productId}-${item.productName}`} className="grid gap-5 px-7 py-6 sm:grid-cols-[110px_1fr_auto] sm:items-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded border border-zinc-300 bg-slate-900 text-cyan-200">
                    <Box className="h-10 w-10" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{item.productName}</h3>
                    <p className="text-zinc-600">SKU: {item.productId}</p>
                    <p className="mt-3 text-sm">{item.quantity} Unit · Weight synced by inventory</p>
                  </div>
                  <div className="text-xl font-black">{money(item.unitPrice * item.quantity)}</div>
                </div>
              ))}
            </div>
            <div className="bg-[#f2effa] px-7 py-6">
              <div className="ml-auto max-w-md space-y-3">
                <AmountRow label="Subtotal" value={money(subtotal)} />
                <AmountRow label="Shipping" value={money(shippingFee)} />
                <AmountRow label="Tax" value={money(0)} />
                <AmountRow label="Total" value={money(order.totalAmount)} strong />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-300 bg-white p-7">
            <h2 className="text-xl font-black">Order Journey</h2>
            <StatusPolicyHint entityType="order" status={order.status} />
            <div className="mt-10 grid gap-4 md:grid-cols-5">
              {["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED"].map((step) => (
                <div key={step} className="text-center">
                  <div className={cn("mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-white", order.status === step || step === "PENDING" ? "bg-blue-700" : "bg-blue-200")}>
                    <Check className="h-5 w-5" />
                  </div>
                  <div className="mt-3 font-bold">{step.replace("_", " ")}</div>
                </div>
              ))}
            </div>
          </section>

          <StatusHistoryTimeline entityType="order" entityId={order.id} />

          <section className="rounded-xl border border-zinc-300 bg-white p-7">
            <h2 className="text-xl font-black">Internal Administration Notes</h2>
            <div className="mt-5 rounded-lg border border-zinc-300 bg-[#f2effa] p-5">
              <div className="flex justify-between text-sm">
                <b>System Automation</b>
                <span>{dateTime(order.updatedAt)}</span>
              </div>
              <p className="mt-2 text-zinc-700">
                Latest status: {order.status}. {events.length} related event(s) found in event store.
              </p>
            </div>
            <div className="mt-5 flex gap-3">
              <input className="flex-1 rounded-md border border-zinc-300 px-4 py-3 text-sm" placeholder="Add a private note..." />
              <button className="rounded-md bg-blue-700 px-5 font-bold text-white">Post</button>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-zinc-300 bg-white">
            <h2 className="border-b border-zinc-300 px-7 py-5 text-xl font-black">Customer Info</h2>
            <div className="p-7">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-lg font-black text-cyan-200">
                  {customer.fullName?.slice(0, 2).toUpperCase() || "CU"}
                </div>
                <div>
                  <div className="text-lg font-black">{customer.fullName}</div>
                  <div className="text-zinc-600">{customer.phone}</div>
                </div>
              </div>
              <div className="mt-7 space-y-4 border-t border-zinc-300 pt-5">
                <AmountRow label="Member Since" value="Synced" />
                <AmountRow label="Total Spend" value={money(order.totalAmount)} />
                <AmountRow label="Last Order" value={dateTime(order.createdAt)} />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-zinc-300 bg-white">
            <div className="h-44 bg-[linear-gradient(135deg,#083344,#0f766e)] p-6 text-white">
              <div className="grid h-full grid-cols-6 gap-2 opacity-60">
                {Array.from({ length: 36 }).map((_, index) => <span key={index} className="border border-cyan-100/50" />)}
              </div>
            </div>
            <div className="p-7">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">Shipping Address</h2>
                {shipment ? <StatusBadge entityType="shipment" status={shipment.status} /> : null}
              </div>
              <p className="mt-4 leading-7">
                {customer.street}<br />
                {customer.city}, {customer.state} {customer.zipCode}<br />
                {customer.country}
              </p>
              <div className="mt-6 border-t border-zinc-300 pt-5">
                <Truck className="mr-2 inline h-4 w-4" />
                {shipment?.carrier || "Carrier pending"} · Track: {shipment?.trackingNumber || "N/A"}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-300 bg-white p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Payment Details</h2>
              {payment ? <StatusBadge entityType="payment" status={payment.status} /> : <ShieldCheck className="h-6 w-6 text-emerald-600" />}
            </div>
            <div className="mt-4 flex items-center gap-2"><CreditCard className="h-4 w-4" /> {payment?.provider || payment?.method || "Payment pending"}</div>
            <div className="mt-5 rounded-lg bg-[#f2effa] p-5 text-sm">
              <AmountRow label="Transaction ID" value={payment?.transactionId || "N/A"} />
              <AmountRow label="Method" value={payment?.method || "N/A"} />
              <AmountRow label="Payment Status" value={payment?.status || "N/A"} />
              <AmountRow label="Captured At" value={dateTime(payment?.paidAt || payment?.createdAt)} />
            </div>
          </section>
        </aside>
      </div>
    </AdminPageFrame>
  );
}

function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong ? "border-t border-zinc-300 pt-3 text-lg font-black" : "")}>
      <span>{label}</span>
      <span className={strong ? "" : "font-semibold"}>{value}</span>
    </div>
  );
}

export function AdminInventoryPage() {
  const { data, loading, error } = useAdminData();
  const low = data.inventory.filter((item) => getAvailable(item) > 0 && getAvailable(item) <= item.lowStockThreshold);
  const out = data.inventory.filter((item) => getAvailable(item) <= 0);
  const value = data.inventory.reduce((sum, item) => sum + item.totalStock * 1000000, 0);
  return (
    <AdminPageFrame
      title="Inventory Management"
      subtitle="Track, monitor, and manage product stock levels across all regions."
    >
      <LoadingBlock loading={loading} error={error} />
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard icon={<ClipboardEdit className="h-6 w-6" />} label="Total SKUs" value={String(data.inventory.length)} />
        <StatCard icon={<AlertTriangle className="h-6 w-6" />} label="Low Stock Items" value={String(low.length)} tone="red" />
        <StatCard icon={<XCircle className="h-6 w-6" />} label="Out of Stock" value={String(out.length)} tone="amber" />
      </div>
      <section className="rounded-xl border border-zinc-300 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-300 px-7 py-5">
          <h2 className="text-xl font-black">Product Inventory</h2>
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">Computed stock state</div>
        </div>
        <InventoryTable items={data.inventory} />
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-zinc-300 bg-white p-7">
          <h2 className="text-xl font-black">Restock Suggestions</h2>
          <div className="mt-5 space-y-4">
            {low.concat(out).slice(0, 3).map((item) => (
              <div key={item.productId} className="flex items-center justify-between rounded-md border border-zinc-300 bg-[#f7f5fb] p-4">
                <div>
                  <div className="font-black">{item.productName}</div>
                  <div className="text-sm text-zinc-600">Available {getAvailable(item)} / threshold {item.lowStockThreshold}</div>
                </div>
                <button className="font-bold text-blue-700">Draft Order</button>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-zinc-300 bg-white p-7">
          <h2 className="text-xl font-black">Stock Valuation</h2>
          <div className="mt-8 text-5xl font-black">{compactMoney(value)}</div>
          <div className="mt-2 text-zinc-600">Current estimated inventory value</div>
          <MiniBars values={data.inventory.slice(0, 7).map((item) => item.totalStock)} />
        </section>
      </div>
    </AdminPageFrame>
  );
}

function InventoryTable({ items, compact }: { items: InventoryItem[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-[#f0edf8] text-xs font-black uppercase tracking-[0.12em]">
          <tr>
            <th className="px-6 py-4">Product ID</th>
            <th className="px-6 py-4">Name</th>
            {!compact ? <th className="px-6 py-4">Total Stock</th> : null}
            <th className="px-6 py-4">Reserved</th>
            <th className="px-6 py-4">Available</th>
            <th className="px-6 py-4">Threshold</th>
            <th className="px-6 py-4">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-300">
          {items.map((item) => {
            const status = productStatus(item);
            return (
              <tr key={item.productId}>
                <td className="px-6 py-5 font-semibold">{item.productId}</td>
                <td className="px-6 py-5 font-black">{item.productName}</td>
                {!compact ? <td className="px-6 py-5">{item.totalStock}</td> : null}
                <td className="px-6 py-5">{item.reservedStock}</td>
                <td className={cn("px-6 py-5 font-black", getAvailable(item) <= item.lowStockThreshold ? "text-red-700" : "")}>{getAvailable(item)}</td>
                <td className="px-6 py-5">{item.lowStockThreshold}</td>
                <td className="px-6 py-5">
                  <StatusBadge
                    entityType="inventory"
                    status={status.label === "Out of Stock" ? "OUT_OF_STOCK" : status.label === "Low Stock" ? "LOW_STOCK" : "ACTIVE"}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPaymentsPage() {
  const { data, loading, error, reload } = useAdminData();
  const completed = data.payments.filter((payment) => payment.status.toUpperCase() === "COMPLETED").length;
  const failed = data.payments.filter((payment) => payment.status.toUpperCase() === "FAILED").length;
  const volume = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return (
    <AdminPageFrame
      title="Payments Management"
      subtitle="Monitor transaction flows, reconciliation status, and system success rates."
    >
      <LoadingBlock loading={loading} error={error} />
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard icon={<CheckCircle2 className="h-6 w-6" />} label="Success Rate" value={`${Math.round((completed / Math.max(1, data.payments.length)) * 100)}%`} note="+0.4%" />
        <StatCard icon={<CreditCard className="h-6 w-6" />} label="Total Volume" value={compactMoney(volume)} />
        <StatCard icon={<AlertTriangle className="h-6 w-6" />} label="Failed Payments" value={String(failed)} tone="red" />
      </div>
      <section className="rounded-xl border border-zinc-300 bg-white">
        <PaymentsTable payments={data.payments} orders={data.orders} onChanged={reload} />
      </section>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="rounded-xl border border-zinc-300 bg-white p-7">
          <h2 className="text-xl font-black">Payment System Health</h2>
          <p className="mt-2 text-zinc-600">Stripe/SePay latency is currently within normal parameters.</p>
          <MiniBars values={[42, 58, 66, 75, 58, 42, 58]} />
        </section>
        <section className="rounded-xl bg-black p-7 text-white">
          <h2 className="text-xl font-black">Audit Log</h2>
          <div className="mt-6 space-y-5 text-sm">
            {data.payments.slice(0, 3).map((payment) => (
              <div key={payment.id}>
                <div className="font-black">Payment {payment.status}</div>
                <div className="text-zinc-400">{payment.id} · {dateTime(payment.updatedAt)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminPageFrame>
  );
}

function PaymentsTable({
  payments,
  orders,
  onChanged,
}: {
  payments: Payment[];
  orders: Order[];
  onChanged?: () => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="bg-[#f0edf8] text-xs font-black uppercase tracking-[0.12em]">
          <tr>
            <th className="px-6 py-4">Payment ID</th>
            <th className="px-6 py-4">Order ID</th>
            <th className="px-6 py-4">Order Status</th>
            <th className="px-6 py-4">Amount</th>
            <th className="px-6 py-4">Method</th>
            <th className="px-6 py-4">Payment Status</th>
            <th className="px-6 py-4">Transaction ID</th>
            <th className="px-6 py-4">Created At</th>
            <th className="px-6 py-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-300">
          {payments.map((payment) => {
            const order = getOrderById(orders, payment.orderId);
            return (
              <tr key={payment.id}>
                <td className="px-6 py-5 font-black text-blue-700">{payment.id.slice(0, 12)}</td>
                <td className="px-6 py-5">
                  <Link href={`/admin/orders/${payment.orderId}`} className="font-bold text-blue-700">
                    {order ? orderLabel(order) : payment.orderId.slice(0, 12)}
                  </Link>
                </td>
                <td className="px-6 py-5">{order ? <StatusBadge entityType="order" status={order.status} /> : "-"}</td>
                <td className="px-6 py-5 font-black">{money(payment.amount)}</td>
                <td className="px-6 py-5">{payment.method}</td>
                <td className="px-6 py-5"><StatusBadge entityType="payment" status={payment.status} /></td>
                <td className="px-6 py-5 text-zinc-600">{payment.transactionId || "-"}</td>
                <td className="px-6 py-5">{dateTime(payment.createdAt)}</td>
                <td className="px-6 py-5">
                  <StatusTransitionMenu
                    entityType="payment"
                    entityId={payment.id}
                    entityLabel={payment.id}
                    status={payment.status}
                    onChanged={onChanged}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AdminShipmentsPage() {
  const { data, loading, error, reload } = useAdminData();
  const delivered = data.shipments.filter((shipment) => shipment.status.toUpperCase() === "DELIVERED").length;
  return (
    <AdminPageFrame title="Shipments" subtitle="Track carriers, labels, and delivery progress.">
      <LoadingBlock loading={loading} error={error} />
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard icon={<Truck className="h-6 w-6" />} label="Total Shipments" value={String(data.shipments.length)} />
        <StatCard icon={<CheckCircle2 className="h-6 w-6" />} label="Delivered" value={String(delivered)} tone="green" />
        <StatCard icon={<Package className="h-6 w-6" />} label="In Transit" value={String(data.shipments.length - delivered)} tone="blue" />
      </div>
      <section className="rounded-xl border border-zinc-300 bg-white">
        <ShipmentsTable shipments={data.shipments} orders={data.orders} onChanged={reload} />
      </section>
    </AdminPageFrame>
  );
}

function ShipmentsTable({
  shipments,
  orders,
  onChanged,
}: {
  shipments: Shipment[];
  orders: Order[];
  onChanged?: () => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="bg-[#f0edf8] text-xs font-black uppercase tracking-[0.12em]">
          <tr>
            <th className="px-6 py-4">Shipment ID</th>
            <th className="px-6 py-4">Order</th>
            <th className="px-6 py-4">Order Status</th>
            <th className="px-6 py-4">Carrier</th>
            <th className="px-6 py-4">Tracking</th>
            <th className="px-6 py-4">Shipment Status</th>
            <th className="px-6 py-4">ETA</th>
            <th className="px-6 py-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-300">
          {shipments.map((shipment) => {
            const order = getOrderById(orders, shipment.orderId);
            return (
              <tr key={shipment.id}>
                <td className="px-6 py-5 font-black text-blue-700">{shipment.id.slice(0, 12)}</td>
                <td className="px-6 py-5">
                  <Link href={`/admin/orders/${shipment.orderId}`} className="font-bold text-blue-700">
                    {order ? orderLabel(order) : shipment.orderId.slice(0, 12)}
                  </Link>
                </td>
                <td className="px-6 py-5">{order ? <StatusBadge entityType="order" status={order.status} /> : "-"}</td>
                <td className="px-6 py-5">{shipment.carrier}</td>
                <td className="px-6 py-5">{shipment.trackingNumber || "-"}</td>
                <td className="px-6 py-5"><StatusBadge entityType="shipment" status={shipment.status} /></td>
                <td className="px-6 py-5">{dateTime(shipment.estimatedDelivery)}</td>
                <td className="px-6 py-5">
                  <StatusTransitionMenu
                    entityType="shipment"
                    entityId={shipment.id}
                    entityLabel={shipment.id}
                    status={shipment.status}
                    onChanged={onChanged}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AdminNotificationsPage() {
  const { data, loading, error, reload } = useAdminData();
  const resend = async (id: string) => {
    await notificationsApi.resend(id);
    await reload();
  };
  return (
    <AdminPageFrame title="Notifications" subtitle="Review outbound emails, SMS, push, and in-app messages.">
      <LoadingBlock loading={loading} error={error} />
      <section className="rounded-xl border border-zinc-300 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#f0edf8] text-xs font-black uppercase tracking-[0.12em]">
              <tr>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Order</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Sent At</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-300">
              {data.notifications.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-5 font-black">{item.subject}</td>
                  <td className="px-6 py-5">{item.type}</td>
                  <td className="px-6 py-5">{item.orderId.slice(0, 12)}</td>
                  <td className="px-6 py-5"><StatusBadge entityType="notification" status={item.status} /></td>
                  <td className="px-6 py-5">{dateTime(item.sentAt || item.createdAt)}</td>
                  <td className="px-6 py-5">
                    <div className="flex gap-2">
                      <button onClick={() => resend(item.id)} className="font-bold text-blue-700">Resend</button>
                      <StatusTransitionMenu
                        entityType="notification"
                        entityId={item.id}
                        entityLabel={item.subject}
                        status={item.status}
                        onChanged={reload}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPageFrame>
  );
}

export function AdminCustomersPage() {
  const { data, loading, error, reload } = useAdminData();
  return (
    <AdminPageFrame title="Customers" subtitle="Manage customers and admin accounts from the auth service.">
      <LoadingBlock loading={loading} error={error} />
      <section className="rounded-xl border border-zinc-300 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#f0edf8] text-xs font-black uppercase tracking-[0.12em]">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Orders</th>
                <th className="px-6 py-4">Lifetime Spend</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-300">
              {data.users.map((user) => {
                const orders = data.orders.filter((order) => order.customerId === user.id);
                const spend = orders.reduce((sum, order) => sum + order.totalAmount, 0);
                return (
                  <tr key={user.id}>
                    <td className="px-6 py-5 font-black">{user.name}</td>
                    <td className="px-6 py-5">{user.email}</td>
                    <td className="px-6 py-5"><Badge className={user.role === "ADMIN" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-700"}>{user.role}</Badge></td>
                    <td className="px-6 py-5"><StatusBadge entityType="user" status={user.status || "ACTIVE"} /></td>
                    <td className="px-6 py-5">{orders.length}</td>
                    <td className="px-6 py-5 font-black">{money(spend)}</td>
                    <td className="px-6 py-5">{dateTime(user.createdAt)}</td>
                    <td className="px-6 py-5">
                      {user.role === "ADMIN" ? (
                        <span title="Admin account protection" className="text-xs font-semibold text-zinc-500">
                          Protected
                        </span>
                      ) : (
                        <StatusTransitionMenu
                          entityType="user"
                          entityId={user.id}
                          entityLabel={user.email}
                          status={user.status || "ACTIVE"}
                          onChanged={reload}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPageFrame>
  );
}

export function AdminSystemMonitorPage() {
  const { data, loading, error, reload } = useAdminData();
  const services = data.health?.services || [];
  const healthy = services.filter((service) => service.status === "healthy").length;
  return (
    <AdminPageFrame
      title="System Monitor"
      subtitle="Real-time health monitoring of TechSphere distributed services and infrastructure."
      actions={
        <button onClick={() => void reload()} className="inline-flex items-center gap-2 rounded-md bg-black px-5 py-3 font-bold text-white"><RefreshCw className="h-4 w-4" /> Force Refresh</button>
      }
    >
      <LoadingBlock loading={loading} error={error} />
      <div className="flex items-center gap-3">
        <StatusBadge entityType="system" status={healthy === services.length ? "healthy" : "degraded"} />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <section key={service.name} className="rounded-xl border border-zinc-300 bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black">{service.name}</h2>
                <p className="text-xs font-bold uppercase tracking-[0.12em]">{service.status}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-between text-sm font-semibold">
              <span>Uptime: {Math.round(service.data?.uptime || 0)}s</span>
              <StatusBadge entityType="system" status={service.status} />
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-[#eceaf3]">
              <div className={cn("h-full rounded-full", service.status === "healthy" ? "bg-emerald-500" : "bg-amber-500")} style={{ width: service.status === "healthy" ? "96%" : "64%" }} />
            </div>
          </section>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="rounded-xl border border-zinc-300 bg-white p-7">
          <h2 className="text-xl font-black">Server Cluster Resources</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <Resource label="CPU Utilization" value={42} />
            <Resource label="Memory Usage" value={68} />
          </div>
        </section>
        <section className="rounded-xl border border-zinc-300 bg-white">
          <div className="border-b border-zinc-300 px-6 py-5 text-xl font-black">Live Event Stream</div>
          <div className="divide-y divide-zinc-200 p-6 text-sm">
            {data.notifications.slice(0, 8).map((item) => (
              <div key={item.id} className="py-3">
                <b>NotificationSvc</b> {item.status}: {item.subject}
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid gap-5 md:grid-cols-4">
        <StatCard icon={<CheckCircle2 className="h-6 w-6" />} label="Total Monthly Uptime" value="99.98%" tone="green" />
        <StatCard icon={<Bell className="h-6 w-6" />} label="Active Webhooks" value={String(data.notifications.length)} />
        <StatCard icon={<RefreshCw className="h-6 w-6" />} label="Average Response Time" value="124ms" tone="amber" />
        <StatCard icon={<AlertTriangle className="h-6 w-6" />} label="Global Errors (24h)" value="42" tone="red" />
      </div>
    </AdminPageFrame>
  );
}

function Resource({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between font-semibold"><span>{label}</span><span>{value}%</span></div>
      <div className="mt-4 h-2 rounded-full bg-[#eceaf3]"><div className="h-full rounded-full bg-blue-700" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

export function AdminAuditLogsPage() {
  const { data, loading, error } = useAdminData();
  const [manualHistory, setManualHistory] = useState<ReturnType<typeof getStatusHistory>>([]);
  useEffect(() => {
    const load = () => setManualHistory(getStatusHistory());
    load();
    window.addEventListener("admin-status-history-changed", load);
    return () => window.removeEventListener("admin-status-history-changed", load);
  }, []);
  const rows = [
    ...manualHistory.map((entry) => ({
      id: entry.id,
      source: "AdminStatusControl",
      action: `${entry.entityType} ${entry.entityId}: ${entry.fromStatus} -> ${entry.toStatus}${entry.reason ? ` (${entry.reason})` : ""}`,
      at: entry.timestamp,
    })),
    ...data.orders.map((order) => ({ id: `order-${order.id}`, source: "OrderSvc", action: `${orderLabel(order)} status ${order.status}`, at: order.updatedAt })),
    ...data.payments.map((payment) => ({ id: `payment-${payment.id}`, source: "PaymentSvc", action: `${payment.method} ${payment.status}`, at: payment.updatedAt })),
    ...data.notifications.map((item) => ({ id: `notification-${item.id}`, source: "NotificationSvc", action: `${item.subject} ${item.status}`, at: item.createdAt })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <AdminPageFrame title="Audit Logs" subtitle="Operational history generated from orders, payments, and notifications.">
      <LoadingBlock loading={loading} error={error} />
      <section className="rounded-xl border border-zinc-300 bg-white">
        <div className="divide-y divide-zinc-200">
          {rows.slice(0, 30).map((row) => (
            <div key={row.id} className="grid gap-3 px-6 py-4 md:grid-cols-[180px_1fr_180px]">
              <b>{row.source}</b>
              <span>{row.action}</span>
              <span className="text-zinc-500">{dateTime(row.at)}</span>
            </div>
          ))}
        </div>
      </section>
    </AdminPageFrame>
  );
}

export function AdminSettingsPage() {
  const { data, loading, error, reload } = useAdminData();
  const [message, setMessage] = useState<string | null>(null);
  const testOrder = data.orders.find((order) => order.id === "order-ts-9601");
  const testPayment = data.payments.find((payment) => payment.orderId === "order-ts-9601");
  const testShipment = data.shipments.find((shipment) => shipment.orderId === "order-ts-9601");
  const seededOrders = data.orders.filter((order) => order.id.startsWith("order-ts-96"));
  const pendingSeededOrders = seededOrders.filter((order) => order.status === "PENDING");
  const consistentSeededOrders = seededOrders.filter((order) =>
    isOrderFlowConsistent(
      order,
      data.payments.find((payment) => payment.orderId === order.id),
      data.shipments.find((shipment) => shipment.orderId === order.id),
    ),
  );

  const notify = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(null), 3000);
  };

  const copyTestIds = async () => {
    await navigator.clipboard.writeText(
      [
        "Admin seeded test data",
        "Pending orders: TS-9601 -> TS-9620",
        "Confirmed orders: TS-9621 -> TS-9630",
        "Processing orders: TS-9631 -> TS-9640",
        "Completed orders: TS-9641 -> TS-9655",
        "Failed payment orders: TS-9656 -> TS-9660",
        "Sample customer: Flow Customer 01",
        "Sample order ID: order-ts-9601",
        `Sample payment ID: ${testPayment?.id || "pay-ts-9601"}`,
        `Sample shipment ID: ${testShipment?.id || "ship-ts-9601"}`,
        "Search keyword: Flow Customer 01 / TS-9601 / pay-ts-9601 / ship-ts-9601",
      ].join("\n"),
    );
    notify("Copied test flow IDs.");
  };

  const exportSnapshot = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      testFlow: {
        order: testOrder,
        payment: testPayment,
        shipment: testShipment,
        notifications: data.notifications.filter((item) => item.orderId === "order-ts-9601"),
      },
      totals: {
        orders: data.orders.length,
        payments: data.payments.length,
        shipments: data.shipments.length,
        notifications: data.notifications.length,
        users: data.users.length,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "techsphere-admin-snapshot.json";
    link.click();
    URL.revokeObjectURL(url);
    notify("Exported admin snapshot.");
  };

  const resetLocalState = () => {
    window.localStorage.removeItem("techsphere_admin_read_notifications");
    window.localStorage.removeItem("techsphere_admin_status_history");
    window.dispatchEvent(new Event("admin-status-history-changed"));
    notify("Cleared local notification and audit cache.");
  };

  return (
    <AdminPageFrame title="Settings" subtitle="Admin workspace, security, and operational preferences.">
      <LoadingBlock loading={loading} error={error} />
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {message}
        </div>
      ) : null}
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black">Seeded Test Data: TS-9601 - TS-9660</h2>
            <p className="mt-1 text-sm text-blue-900">
              Uses 20 pending, 10 confirmed, 10 processing, 15 completed, 5 failed payments, 5 delayed shipments, and 10 notification events.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={copyTestIds} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white">Copy Test IDs</button>
            <Link href="/admin/orders/order-ts-9601" className="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-700">
              Open Pending Order
            </Link>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SettingRow label="Pending orders" value={String(pendingSeededOrders.length)} />
          <SettingRow label="Flow-state orders" value={String(Math.max(0, seededOrders.length - pendingSeededOrders.length))} />
          <SettingRow label="Consistent flows" value={`${consistentSeededOrders.length} / ${seededOrders.length}`} />
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-zinc-300 bg-white p-7">
          <h2 className="text-xl font-black">Useful Admin Actions</h2>
          <div className="mt-5 space-y-4">
            <SettingAction
              title="Refresh live data"
              description="Reload orders, payments, shipments, notifications, users, and health data from the gateway."
              action="Refresh"
              onClick={() => void reload().then(() => notify("Admin data refreshed."))}
            />
            <SettingAction
              title="Export admin snapshot"
              description="Download a JSON snapshot with totals and the TS-9601 sample flow payload."
              action="Export JSON"
              onClick={exportSnapshot}
            />
            <SettingAction
              title="Reset local admin state"
              description="Clear local read-notification flags and manual status audit cache."
              action="Reset"
              onClick={resetLocalState}
            />
          </div>
        </section>
        <section className="rounded-xl border border-zinc-300 bg-white p-7">
          <h2 className="text-xl font-black">Active Configuration</h2>
          <div className="mt-5 space-y-4">
            <SettingRow label="Admin role guard" value="Enabled" />
            <SettingRow label="Global search" value="Customer / order / payment / shipment" />
            <SettingRow label="Admin route" value="/admin" />
            <SettingRow label="Data source" value="API Gateway" />
            <SettingRow label="Status controls" value="Validated transitions" />
          </div>
        </section>
      </div>
    </AdminPageFrame>
  );
}

function SettingAction({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-[#f8f6fc] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-black">{title}</div>
        <div className="mt-1 text-sm text-zinc-600">{description}</div>
      </div>
      <button onClick={onClick} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-bold hover:border-blue-400 hover:text-blue-700">
        {action}
      </button>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-[#f8f6fc] px-4 py-3">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
