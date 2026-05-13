"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  CreditCard,
  Package,
  Radio,
  RefreshCw,
  Server,
  ShoppingBag,
  Trash2,
  Truck,
  Warehouse,
  Wifi,
  WifiOff,
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
import { useEventStream, type SSEEvent } from "@/hooks/use-event-stream";
import {
  healthApi,
  ordersApi,
  paymentsApi,
  shipmentsApi,
  notificationsApi,
  type HealthStatus,
  type OrderStats,
} from "@/lib/api";
import { formatVND } from "@/lib/commerce";

function eventStyle(type: string) {
  if (type.startsWith("ORDER_PLACED")) {
    return { icon: ShoppingBag, color: "bg-blue-500", label: "Đơn mới" };
  }
  if (type.startsWith("ORDER_CONFIRMED")) {
    return { icon: CheckCircle2, color: "bg-green-600", label: "Đơn xác nhận" };
  }
  if (type.startsWith("ORDER_CANCELLED")) {
    return { icon: XCircle, color: "bg-red-600", label: "Đơn bị hủy" };
  }
  if (type.startsWith("STOCK")) {
    return { icon: Warehouse, color: "bg-emerald-600", label: "Kho hàng" };
  }
  if (type.startsWith("LOW_STOCK")) {
    return { icon: AlertTriangle, color: "bg-yellow-500", label: "Sắp hết hàng" };
  }
  if (type.startsWith("PAYMENT")) {
    return { icon: CreditCard, color: "bg-orange-500", label: "Thanh toán" };
  }
  if (type.startsWith("SHIPPING") || type.startsWith("ORDER_SHIPPED")) {
    return { icon: Truck, color: "bg-purple-500", label: "Vận chuyển" };
  }
  if (type.startsWith("NOTIFICATION")) {
    return { icon: Bell, color: "bg-rose-500", label: "Thông báo" };
  }
  return { icon: Activity, color: "bg-slate-500", label: type || "Event" };
}

export default function DashboardPage() {
  const { events, connected, clearEvents } = useEventStream();
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [counts, setCounts] = useState({
    payments: 0,
    shipments: 0,
    notifications: 0,
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextStats, nextHealth, payments, shipments, notifications] =
        await Promise.all([
          ordersApi.getStats().catch(() => null),
          healthApi.check().catch(() => null),
          paymentsApi.list().catch(() => []),
          shipmentsApi.list().catch(() => []),
          notificationsApi.list().catch(() => []),
        ]);
      setStats(nextStats);
      setHealth(nextHealth);
      setCounts({
        payments: payments.length,
        shipments: shipments.length,
        notifications: notifications.length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 10000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (events[0]?.type?.startsWith("ORDER_")) refresh();
  }, [events, refresh]);

  const groupedEvents = useMemo(() => {
    return events.reduce<Record<string, number>>((acc, event) => {
      const group = event.type.split("_")[0] || "OTHER";
      acc[group] = (acc[group] ?? 0) + 1;
      return acc;
    }, {});
  }, [events]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard vận hành ecommerce"
        description="Theo dõi sức khỏe microservices, thống kê đơn hàng và event stream real-time."
        icon={<Activity className="h-6 w-6 text-primary" />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant={connected ? "default" : "destructive"}
          className="gap-2 px-3 py-1"
        >
          {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {connected ? "SSE đang kết nối" : "SSE mất kết nối"}
        </Badge>
        <Badge variant="outline" className="gap-2 px-3 py-1">
          <Radio className="h-4 w-4" />
          {events.length} events
        </Badge>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Tải lại
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Tổng đơn hàng"
          value={stats?.total ?? 0}
          icon={Package}
          loading={loading}
        />
        <MetricCard
          title="Doanh thu"
          value={formatVND(stats?.totalRevenue ?? 0)}
          icon={CreditCard}
          loading={loading}
        />
        <MetricCard
          title="Thanh toán"
          value={counts.payments}
          icon={CreditCard}
          loading={loading}
        />
        <MetricCard
          title="Vận đơn"
          value={counts.shipments}
          icon={Truck}
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="rounded-lg">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Live event stream</CardTitle>
              <CardDescription>
                Các event phát ra từ Order, Inventory, Payment, Shipping và
                Notification service.
              </CardDescription>
            </div>
            <Button variant="outline" size="icon-sm" onClick={clearEvents}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-3">
              {events.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                  Chưa có event. Hãy checkout một đơn ở trang Mua hàng.
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {events.map((event) => (
                    <EventItem key={`${event.id}-${event.timestamp}`} event={event} />
                  ))}
                </AnimatePresence>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Service health</CardTitle>
              <CardDescription>
                API Gateway kiểm tra từng microservice qua endpoint /health.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {health?.services?.length ? (
                health.services.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{service.name}</span>
                    </div>
                    <Badge
                      variant={
                        service.status === "healthy" ? "default" : "destructive"
                      }
                    >
                      {service.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Không lấy được health. Kiểm tra API Gateway tại port 4000.
                </div>
              )}
              <Separator />
              <p className="text-xs text-muted-foreground">
                Gateway status: {health?.status ?? "unknown"} · SSE clients:{" "}
                {health?.sseClients ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Phân bổ nghiệp vụ</CardTitle>
              <CardDescription>
                Đơn hàng, trạng thái và event được gom nhóm để quan sát nhanh.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Trạng thái đơn hàng</p>
                {stats?.byStatus && Object.keys(stats.byStatus).length > 0 ? (
                  Object.entries(stats.byStatus).map(([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{status}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Chưa có đơn.</p>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-semibold">Event theo domain</p>
                {Object.keys(groupedEvents).length > 0 ? (
                  Object.entries(groupedEvents).map(([group, count]) => (
                    <div
                      key={group}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{group}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Chưa có event.</p>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Thông báo đã gửi</span>
                <Badge variant="outline">{counts.notifications}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Card className="rounded-lg py-5">
        <CardContent className="flex items-center gap-4 px-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="truncate text-2xl font-bold">
              {loading ? "..." : value}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EventItem({ event }: { event: SSEEvent }) {
  const style = eventStyle(event.type);
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className="mb-3 flex gap-3 rounded-lg border p-3"
    >
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white ${style.color}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{style.label}</p>
          <Badge variant="outline">{event.type}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {event.source} · {new Date(event.timestamp).toLocaleString("vi-VN")} ·
          correlation {event.correlationId?.slice(0, 10) || "n/a"}
        </p>
      </div>
    </motion.div>
  );
}
