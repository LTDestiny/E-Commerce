"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Loader2,
  Package,
  ReceiptText,
  RefreshCw,
  Search,
  Truck,
  XCircle,
  TrendingUp,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import {
  notificationsApi,
  ordersApi,
  getStoredUser,
  paymentsApi,
  shipmentsApi,
  type NotificationItem,
  type Order,
  type Payment,
  type Shipment,
  type StoredEvent,
} from "@/lib/api";
import { formatVND } from "@/lib/commerce";

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (["CONFIRMED", "COMPLETED", "DELIVERED", "SHIPPED"].includes(status)) {
    return "default";
  }
  if (["CANCELLED", "FAILED"].includes(status)) return "destructive";
  if (["PENDING", "PROCESSING", "INVENTORY_RESERVED"].includes(status)) {
    return "secondary";
  }
  return "outline";
}

function statusIcon(status: string) {
  if (["CONFIRMED", "COMPLETED", "DELIVERED", "SHIPPED"].includes(status)) {
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  }
  if (["CANCELLED", "FAILED"].includes(status)) {
    return <XCircle className="h-4 w-4 text-red-600" />;
  }
  return <Loader2 className="h-4 w-4 animate-spin text-orange-600" />;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [eventsByOrder, setEventsByOrder] = useState<Record<string, StoredEvent[]>>(
    {},
  );
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tất cả");
  const [loading, setLoading] = useState(false);

  // Authorization check
  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== "ADMIN") {
      router.push("/auth?next=/admin/orders");
    } else {
      setAuthorized(true);
    }
  }, [router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextOrders, nextPayments, nextShipments, nextNotifications] =
        await Promise.all([
          ordersApi.list(true).catch(() => []),
          paymentsApi.list().catch(() => []),
          shipmentsApi.list().catch(() => []),
          notificationsApi.list().catch(() => []),
        ]);
      setOrders(nextOrders);
      setPayments(nextPayments);
      setShipments(nextShipments);
      setNotifications(nextNotifications);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authorized) {
      refresh();
    }
  }, [authorized, refresh]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalRevenue = orders
      .filter((o) => o.status !== "CANCELLED" && o.status !== "FAILED")
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const activeShipmentsCount = shipments.filter(
      (s) => s.status === "SCHEDULED" || s.status === "SHIPPED",
    ).length;

    const uniqueCustomers = new Set(orders.map((o) => o.customerId)).size;

    return {
      totalRevenue,
      totalOrders: orders.length,
      activeShipmentsCount,
      uniqueCustomers,
    };
  }, [orders, shipments]);

  const statuses = useMemo(() => {
    const uniqueStatuses = Array.from(new Set(orders.map((o) => o.status)));
    return ["Tất cả", ...uniqueStatuses];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...orders]
      .reverse()
      .filter((o) => statusFilter === "Tất cả" || o.status === statusFilter)
      .filter((o) => {
        if (!normalizedQuery) return true;
        return (
          o.id.toLowerCase().includes(normalizedQuery) ||
          o.customerId.toLowerCase().includes(normalizedQuery) ||
          o.items.some((item) =>
            item.productName.toLowerCase().includes(normalizedQuery),
          ) ||
          o.shippingAddress.fullName.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [orders, query, statusFilter]);

  async function loadOrderEvents(orderId: string) {
    const events = await ordersApi.getEvents(orderId).catch(() => []);
    setEventsByOrder((current) => ({ ...current, [orderId]: events }));
  }

  async function toggleOrder(orderId: string) {
    const next = expandedOrder === orderId ? null : orderId;
    setExpandedOrder(next);
    if (next && !eventsByOrder[orderId]) await loadOrderEvents(orderId);
  }

  if (!authorized) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Đang xác thực quyền Admin...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bảng Quản Trị Đơn Hàng"
        description="Quản lý toàn bộ đơn hàng trong hệ thống, theo dõi doanh thu và timeline audit sự kiện."
        icon={<ShieldCheck className="h-6 w-6 text-primary" />}
      />

      {/* Analytics Dashboard Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Tổng Doanh Thu"
          value={formatVND(stats.totalRevenue)}
          description="Không tính đơn đã hủy"
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          gradient="from-green-500/10 to-emerald-500/5"
        />
        <MetricCard
          title="Tổng Đơn Hàng"
          value={stats.totalOrders}
          description="Toàn bộ lịch sử giao dịch"
          icon={<Package className="h-5 w-5 text-blue-600" />}
          gradient="from-blue-500/10 to-indigo-500/5"
        />
        <MetricCard
          title="Đang Vận Chuyển"
          value={stats.activeShipmentsCount}
          description="Đang xử lý & đang giao"
          icon={<Truck className="h-5 w-5 text-purple-600" />}
          gradient="from-purple-500/10 to-pink-500/5"
        />
        <MetricCard
          title="Tổng Khách Hàng"
          value={stats.uniqueCustomers}
          description="Khách hàng đã mua sắm"
          icon={<Users className="h-5 w-5 text-orange-600" />}
          gradient="from-orange-500/10 to-amber-500/5"
        />
      </div>

      {/* Control Card for Search and Filter */}
      <Card className="rounded-lg">
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2 rounded-md border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo ID đơn, ID khách, tên khách hàng hoặc sản phẩm..."
              className="h-10 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statuses.map((item) => (
              <Button
                key={item}
                variant={statusFilter === item ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(item)}
              >
                {item}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon-sm"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Order List */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Danh sách tất cả đơn hàng</CardTitle>
          <CardDescription>
            Theo dõi dòng dữ liệu microservices và trạng thái của toàn bộ đơn hàng trong hệ thống TechSphere.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[720px] pr-3">
            {filteredOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                Không tìm thấy đơn hàng nào khớp với bộ lọc.
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredOrders.map((order) => (
                  <AdminOrderRow
                    key={order.id}
                    order={order}
                    payment={payments.find((p) => p.orderId === order.id)}
                    shipment={shipments.find((s) => s.orderId === order.id)}
                    notifications={notifications.filter(
                      (n) => n.orderId === order.id,
                    )}
                    events={eventsByOrder[order.id] ?? []}
                    expanded={expandedOrder === order.id}
                    onToggle={() => toggleOrder(order.id)}
                  />
                ))}
              </AnimatePresence>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
  gradient,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <Card className={`rounded-lg overflow-hidden border bg-gradient-to-br ${gradient}`}>
      <CardContent className="p-5 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="p-2 bg-background/80 rounded-md border shadow-sm">
            {icon}
          </div>
        </div>
        <div>
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          <p className="text-xs text-muted-foreground/80 mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminOrderRow({
  order,
  payment,
  shipment,
  notifications,
  events,
  expanded,
  onToggle,
}: {
  order: Order;
  payment?: Payment;
  shipment?: Shipment;
  notifications: NotificationItem[];
  events: StoredEvent[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-lg border bg-card overflow-hidden shadow-sm hover:shadow transition-shadow"
    >
      <button
        onClick={onToggle}
        className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          {statusIcon(order.status)}
          <div>
            <p className="font-semibold">#{order.id.slice(0, 12)}</p>
            <p className="text-xs text-muted-foreground">
              Khách hàng: <span className="font-medium text-foreground">{order.shippingAddress.fullName}</span> ({order.customerId.slice(0, 8)})
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
          <span className="font-semibold">{formatVND(order.totalAmount)}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t p-4 bg-muted/10"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Products & Shipping Address info */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Thông tin giỏ hàng</p>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div
                      key={`${order.id}-${item.productId}`}
                      className="flex justify-between rounded-md border bg-background p-3 text-sm"
                    >
                      <span>
                        {item.productName} <span className="text-muted-foreground">x{item.quantity}</span>
                      </span>
                      <span className="font-medium">
                        {formatVND(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Địa chỉ giao hàng</p>
                <div className="rounded-md border bg-background p-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Người nhận:</span> <span className="font-medium">{order.shippingAddress.fullName}</span></p>
                  <p><span className="text-muted-foreground">Số điện thoại:</span> {order.shippingAddress.phone}</p>
                  <p><span className="text-muted-foreground">Địa chỉ:</span> {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.country}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Chi tiết hệ thống</p>
                <div className="rounded-md border bg-background p-3 text-xs space-y-1 text-muted-foreground">
                  <p>ID Đơn hàng: <span className="font-mono text-foreground select-all">{order.id}</span></p>
                  <p>ID Khách hàng: <span className="font-mono text-foreground select-all">{order.customerId}</span></p>
                  <p>Thời gian đặt: <span className="text-foreground">{new Date(order.createdAt).toLocaleString("vi-VN")}</span></p>
                </div>
              </div>
            </div>

            {/* Microservice Processing Timeline */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Thông tin xử lý Microservices</p>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <Info label="Trạng thái đơn" value={order.status} />
                  <Info label="Thanh toán" value={payment?.status ?? "Chưa khởi tạo"} />
                  <Info label="Cổng giao hàng" value={shipment?.carrier ?? "Chưa lên lịch"} />
                  <Info label="Mã vận đơn" value={shipment?.trackingNumber ?? "Chưa có"} />
                  <Info label="Trạng thái vận chuyển" value={shipment?.status ?? "Chưa có"} />
                  <Info label="Email thông báo" value={`${notifications.filter(n => n.type === "EMAIL").length} email`} />
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Saga Event Timeline (Audit Log)</p>
                {events.length === 0 ? (
                  <p className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground text-center">
                    Đang tải audit logs từ Event Store...
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {events.map((stored) => (
                      <div
                        key={stored.sequenceNumber}
                        className="flex gap-3 rounded-md border bg-background p-2 text-xs"
                      >
                        <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{stored.event.type}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Nguồn: <span className="font-medium text-foreground">{stored.event.source}</span> ·{" "}
                            {new Date(stored.event.timestamp).toLocaleTimeString("vi-VN")} (Sequence: {stored.sequenceNumber})
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background p-2.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
