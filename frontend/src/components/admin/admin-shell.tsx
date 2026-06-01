"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  CreditCard,
  FileClock,
  Gauge,
  Grid3X3,
  LogOut,
  PackageCheck,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import {
  clearAuthSession,
  notificationsApi,
  ordersApi,
  paymentsApi,
  shipmentsApi,
  syncClientAuthState,
  usersApi,
  type AdminUserRecord,
  type AuthUser,
  type NotificationItem,
  type Order,
  type Payment,
  type Shipment,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/shipments", label: "Shipments", icon: Truck },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/system-monitor", label: "System Monitor", icon: BarChart3 },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileClock },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin/dashboard") return pathname === "/admin/dashboard" || pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const synced = syncClientAuthState();
      if (!synced || synced.role !== "ADMIN") {
        router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
        return;
      }

      setUser(synced);
      setChecked(true);
    });
  }, [pathname, router]);

  useEffect(() => {
    if (!checked) return;
    queueMicrotask(() => {
      const raw = window.localStorage.getItem("techsphere_admin_read_notifications");
      setReadIds(new Set(raw ? JSON.parse(raw) : []));
      void Promise.allSettled([
        notificationsApi.list(),
        ordersApi.list(true),
        paymentsApi.list(),
        shipmentsApi.list(),
        usersApi.list(),
      ]).then(([notificationResult, orderResult, paymentResult, shipmentResult, userResult]) => {
        if (notificationResult.status === "fulfilled") setNotifications(notificationResult.value);
        if (orderResult.status === "fulfilled") setOrders(orderResult.value);
        if (paymentResult.status === "fulfilled") setPayments(paymentResult.value);
        if (shipmentResult.status === "fulfilled") setShipments(shipmentResult.value);
        if (userResult.status === "fulfilled") setUsers(userResult.value);
      });
    });
  }, [checked]);

  useEffect(() => {
    if (!notificationOpen) return;
    const close = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (notificationRef.current?.contains(target)) return;
      setNotificationOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", escape);
    };
  }, [notificationOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (searchRef.current?.contains(event.target as Node)) return;
      setSearchOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", escape);
    };
  }, [searchOpen]);

  useEffect(() => {
    queueMicrotask(() => setSearchOpen(false));
  }, [pathname]);

  const feed = useMemo(() => {
    const orderFeed = orders.slice(0, 6).map((order) => ({
      id: `order-${order.id}`,
      orderId: order.id,
      title: order.status === "PENDING" ? "New pending order" : "Order updated",
      body: `${order.orderCode || order.id.slice(0, 8)} · ${order.status}`,
      at: order.createdAt,
    }));
    const paymentFeed = payments.slice(0, 6).map((payment) => ({
      id: `payment-${payment.id}`,
      orderId: payment.orderId,
      title: `Payment ${payment.status.toLowerCase()}`,
      body: `${payment.method} · ${new Intl.NumberFormat("vi-VN").format(payment.amount)} VND`,
      at: payment.updatedAt,
    }));
    const shipmentFeed = shipments.slice(0, 6).map((shipment) => ({
      id: `shipment-${shipment.id}`,
      orderId: shipment.orderId,
      title: `Shipment ${shipment.status.toLowerCase()}`,
      body: shipment.trackingNumber || shipment.carrier,
      at: shipment.updatedAt,
    }));
    const notificationFeed = notifications.slice(0, 8).map((item) => ({
      id: `notification-${item.id}`,
      orderId: item.orderId,
      title: item.status === "FAILED" ? "Customer notification failed" : "Customer notification sent",
      body: item.subject,
      at: item.createdAt,
    }));
    return [...orderFeed, ...paymentFeed, ...shipmentFeed, ...notificationFeed]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 12);
  }, [notifications, orders, payments, shipments]);

  const searchResults = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (query.length < 2) return [];

    const userById = new Map(users.map((item) => [item.id, item]));
    const orderById = new Map(orders.map((item) => [item.id, item]));
    const matches = (value?: string | null) => String(value || "").toLowerCase().includes(query);
    const results: Array<{ id: string; href: string; type: string; title: string; body: string }> = [];

    for (const order of orders) {
      const customer = userById.get(order.customerId);
      const customerName = customer?.name || order.shippingAddress?.fullName || "Customer";
      const customerEmail = customer?.email || "";
      if (matches(order.id) || matches(order.orderCode) || matches(customerName) || matches(customerEmail)) {
        results.push({
          id: `order-${order.id}`,
          href: `/admin/orders/${order.id}`,
          type: "Order",
          title: order.orderCode || order.id,
          body: `${customerName} - ${order.status}`,
        });
      }
    }

    for (const payment of payments) {
      const order = orderById.get(payment.orderId);
      const customer = order ? userById.get(order.customerId) : null;
      if (matches(payment.id) || matches(payment.orderId) || matches(payment.transactionId) || matches(customer?.name)) {
        results.push({
          id: `payment-${payment.id}`,
          href: `/admin/orders/${payment.orderId}`,
          type: "Payment",
          title: payment.id,
          body: `${payment.method} - ${payment.status} - ${order?.orderCode || payment.orderId}`,
        });
      }
    }

    for (const shipment of shipments) {
      const order = orderById.get(shipment.orderId);
      const customer = order ? userById.get(order.customerId) : null;
      if (matches(shipment.id) || matches(shipment.orderId) || matches(shipment.trackingNumber) || matches(customer?.name)) {
        results.push({
          id: `shipment-${shipment.id}`,
          href: `/admin/orders/${shipment.orderId}`,
          type: "Shipment",
          title: shipment.id,
          body: `${shipment.carrier} - ${shipment.status} - ${order?.orderCode || shipment.orderId}`,
        });
      }
    }

    for (const customer of users) {
      if (matches(customer.name) || matches(customer.email) || matches(customer.id)) {
        results.push({
          id: `customer-${customer.id}`,
          href: "/admin/customers",
          type: "Customer",
          title: customer.name,
          body: `${customer.email} - ${customer.status || "ACTIVE"}`,
        });
      }
    }

    return results.slice(0, 10);
  }, [deferredSearchQuery, orders, payments, shipments, users]);

  const unreadCount = feed.filter((item) => !readIds.has(item.id)).length;

  const markRead = (id: string) => {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    window.localStorage.setItem("techsphere_admin_read_notifications", JSON.stringify([...next]));
  };

  const markAllRead = () => {
    const next = new Set(feed.map((item) => item.id));
    setReadIds(next);
    window.localStorage.setItem("techsphere_admin_read_notifications", JSON.stringify([...next]));
  };

  const logout = () => {
    clearAuthSession();
    router.replace("/auth?next=/admin");
  };

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5fb] text-sm text-zinc-600">
        Dang kiem tra quyen admin...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6fc] text-[#111114]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-zinc-300 bg-[#fbf9ff] lg:flex lg:flex-col">
        <div className="px-6 py-7">
          <Link href="/admin/dashboard" className="block">
            <div className="text-xl font-black tracking-tight">TechSphere</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Operational Truth
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-4 rounded-md border-l-2 border-transparent px-5 py-3 text-[15px] font-medium transition",
                  active
                    ? "border-blue-600 bg-[#edeaf7] text-blue-700"
                    : "text-zinc-800 hover:bg-white hover:text-blue-700",
                )}
              >
                <Icon className={cn("h-5 w-5", active ? "text-blue-700" : "text-zinc-900")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-300 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-[#f1eef9] p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-cyan-200">
              AD
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{user?.name || "Admin User"}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                System Root
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-md p-2 text-zinc-500 hover:bg-white hover:text-red-600"
              aria-label="Dang xuat"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-300 bg-[#fbf9ff]/95 px-4 backdrop-blur lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div ref={searchRef} className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && searchResults[0]) {
                    event.preventDefault();
                    router.push(searchResults[0].href);
                    setSearchQuery("");
                    setSearchOpen(false);
                  }
                }}
                className="h-11 w-full rounded-md border border-zinc-300 bg-[#f2f0fa] pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                placeholder="Search customer, order, shipment, payment..."
              />
              {searchOpen && searchQuery.trim().length >= 2 ? (
                <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-2xl">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-sm text-zinc-500">No matching admin data found.</div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto p-2">
                      {searchResults.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => {
                            setSearchQuery("");
                            setSearchOpen(false);
                          }}
                          className="block rounded-xl p-3 hover:bg-[#f3f1fa]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-black">{item.title}</div>
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-blue-700">
                              {item.type}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-zinc-600">{item.body}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <div className="ml-4 flex items-center gap-4">
            <div ref={notificationRef} className="relative">
              <button
                onClick={() => setNotificationOpen((value) => !value)}
                className="relative rounded-md p-2 hover:bg-[#edeaf7]"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </button>
              {notificationOpen ? (
                <div className="absolute right-0 top-12 z-50 w-[380px] rounded-2xl border border-zinc-300 bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
                    <div>
                      <div className="font-black">Operational notifications</div>
                      <div className="text-xs text-zinc-500">{unreadCount} unread updates</div>
                    </div>
                    <button onClick={markAllRead} className="text-xs font-bold text-blue-700">
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-[430px] overflow-y-auto p-2">
                    {feed.length === 0 ? (
                      <div className="p-6 text-sm text-zinc-500">No operational updates yet.</div>
                    ) : (
                      feed.map((item) => (
                        <Link
                          key={item.id}
                          href={`/admin/orders/${item.orderId}`}
                          onClick={() => {
                            markRead(item.id);
                            setNotificationOpen(false);
                          }}
                          className={cn(
                            "block rounded-xl p-3 text-sm hover:bg-[#f3f1fa]",
                            readIds.has(item.id) ? "opacity-70" : "bg-blue-50/50",
                          )}
                        >
                          <div className="flex justify-between gap-3">
                            <div className="font-black">{item.title}</div>
                            {!readIds.has(item.id) ? <span className="mt-1 h-2 w-2 rounded-full bg-blue-700" /> : null}
                          </div>
                          <div className="mt-1 text-zinc-600">{item.body}</div>
                          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                            {new Date(item.at).toLocaleString("vi-VN")}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <Link href="/" className="rounded-md p-2 hover:bg-[#edeaf7]" aria-label="Back to storefront" title="Back to storefront">
              <Grid3X3 className="h-5 w-5" />
            </Link>
            <div className="hidden h-8 w-px bg-zinc-300 sm:block" />
            <div className="hidden text-right sm:block">
              <div className="text-sm font-bold">{user?.name || "Admin User"}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Super Admin
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-zinc-300 bg-slate-950 text-xs font-black text-cyan-200">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-64px)] overflow-hidden px-4 py-8 lg:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}
