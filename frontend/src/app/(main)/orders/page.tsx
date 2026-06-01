"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [eventsByOrder, setEventsByOrder] = useState<Record<string, StoredEvent[]>>(
    {},
  );
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextOrders, nextPayments, nextShipments, nextNotifications] =
        await Promise.all([
          ordersApi.list().catch(() => []),
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
    refresh();
  }, [refresh]);

  const statuses = useMemo(
    () => ["Tất cả", ...Array.from(new Set(orders.map((order) => order.status)))],
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...orders]
      .reverse()
      .filter((order) => status === "Tất cả" || order.status === status)
      .filter((order) => {
        if (!normalizedQuery) return true;
        return (
          order.id.toLowerCase().includes(normalizedQuery) ||
          order.items.some((item) =>
            item.productName.toLowerCase().includes(normalizedQuery),
          )
        );
      });
  }, [orders, query, status]);

  async function loadOrderEvents(orderId: string) {
    const events = await ordersApi.getEvents(orderId).catch(() => []);
    setEventsByOrder((current) => ({ ...current, [orderId]: events }));
  }

  async function toggleOrder(orderId: string) {
    const next = expandedOrder === orderId ? null : orderId;
    setExpandedOrder(next);
    if (next && !eventsByOrder[orderId]) await loadOrderEvents(orderId);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lịch sử đơn hàng"
        description="Theo dõi đơn, thanh toán, vận chuyển, thông báo và timeline xử lý."
        icon={<ReceiptText className="h-6 w-6 text-primary" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Đơn hàng" value={orders.length} icon={<Package />} />
        <Metric title="Thanh toán" value={payments.length} icon={<CreditCard />} />
        <Metric title="Vận đơn" value={shipments.length} icon={<Truck />} />
        <Metric title="Thông báo" value={notifications.length} icon={<ReceiptText />} />
      </div>

      <Card className="rounded-lg">
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2 rounded-md border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo mã đơn hoặc sản phẩm..."
              className="h-10 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statuses.map((item) => (
              <Button
                key={item}
                variant={status === item ? "default" : "outline"}
                size="sm"
                onClick={() => setStatus(item)}
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

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Đơn gần đây</CardTitle>
          <CardDescription>
            Mở từng đơn để xem sản phẩm, thanh toán, vận chuyển và event audit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[680px] pr-3">
            {filteredOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                Chưa có đơn phù hợp. Hãy checkout ở trang Giỏ hàng.
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    payment={payments.find((item) => item.orderId === order.id)}
                    shipment={shipments.find((item) => item.orderId === order.id)}
                    notifications={notifications.filter(
                      (item) => item.orderId === order.id,
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

function Metric({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactElement<{ className?: string }>;
}) {
  return (
    <Card className="rounded-lg py-5">
      <CardContent className="flex items-center gap-4 px-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderRow({
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
      className="mb-3 rounded-lg border bg-card"
    >
      <button
        onClick={onToggle}
        className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          {statusIcon(order.status)}
          <div>
            <p className="font-semibold">#{order.id.slice(0, 12)}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(order.createdAt).toLocaleString("vi-VN")}
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
          className="border-t p-4"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold">Sản phẩm</p>
              {order.items.map((item) => (
                <div
                  key={`${order.id}-${item.productId}`}
                  className="flex justify-between rounded-md border p-3 text-sm"
                >
                  <span>
                    {item.productName} x {item.quantity}
                  </span>
                  <span className="font-medium">
                    {formatVND(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
              <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                Giao cho {order.shippingAddress.fullName},{" "}
                {order.shippingAddress.city}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">Thông tin xử lý</p>
              <Info label="Thanh toán" value={payment?.status ?? "Chưa có"} />
              <Info label="Mã giao hàng" value={shipment?.trackingNumber ?? "Chưa có"} />
              <Info label="Trạng thái giao" value={shipment?.status ?? "Chưa có"} />
              <Info label="Thông báo" value={`${notifications.length} thông báo`} />
              <Separator />
              <p className="text-sm font-semibold">Event timeline</p>
              {events.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Chưa tải được timeline hoặc backend chưa có event.
                </p>
              ) : (
                events.map((stored) => (
                  <div
                    key={stored.sequenceNumber}
                    className="flex gap-3 rounded-md border p-3"
                  >
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{stored.event.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {stored.event.source} ·{" "}
                        {new Date(stored.event.timestamp).toLocaleTimeString("vi-VN")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
