"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  Server,
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  Package,
  CreditCard,
  Warehouse,
  Truck,
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/shared/page-header";
import { useEventStream, type SSEEvent } from "@/hooks/use-event-stream";
import {
  ordersApi,
  healthApi,
  type OrderStats,
  type HealthStatus,
} from "@/lib/api";

// ==========================================
// Helper: Event type → color & icon
// ==========================================
function getEventStyle(type: string) {
  if (type.startsWith("ORDER_PLACED"))
    return { color: "bg-blue-500", icon: Package, label: "Order Placed" };
  if (type.startsWith("ORDER_CONFIRMED"))
    return {
      color: "bg-green-500",
      icon: CheckCircle,
      label: "Order Confirmed",
    };
  if (type.startsWith("ORDER_CANCELLED"))
    return { color: "bg-red-500", icon: XCircle, label: "Order Cancelled" };
  if (type.startsWith("ORDER_COMPLETED"))
    return {
      color: "bg-emerald-500",
      icon: CheckCircle,
      label: "Order Completed",
    };
  if (type.startsWith("STOCK_RESERVED"))
    return { color: "bg-cyan-500", icon: Warehouse, label: "Stock Reserved" };
  if (type.startsWith("STOCK_RESERVATION_FAILED"))
    return {
      color: "bg-red-400",
      icon: AlertTriangle,
      label: "Stock Failed",
    };
  if (type.startsWith("STOCK_RELEASED"))
    return { color: "bg-teal-500", icon: Warehouse, label: "Stock Released" };
  if (type.startsWith("LOW_STOCK"))
    return {
      color: "bg-yellow-500",
      icon: AlertTriangle,
      label: "Low Stock Alert",
    };
  if (type.startsWith("PAYMENT_PROCESSED"))
    return {
      color: "bg-green-600",
      icon: CreditCard,
      label: "Payment OK",
    };
  if (type.startsWith("PAYMENT_FAILED"))
    return {
      color: "bg-red-600",
      icon: CreditCard,
      label: "Payment Failed",
    };
  if (type.startsWith("PAYMENT_REFUNDED"))
    return {
      color: "bg-orange-500",
      icon: CreditCard,
      label: "Refunded",
    };
  if (type.startsWith("SHIPPING_SCHEDULED"))
    return { color: "bg-purple-500", icon: Truck, label: "Ship Scheduled" };
  if (type.startsWith("ORDER_SHIPPED"))
    return { color: "bg-purple-600", icon: Truck, label: "Shipped" };
  if (type.startsWith("ORDER_DELIVERED"))
    return { color: "bg-green-700", icon: Truck, label: "Delivered" };
  if (type.startsWith("NOTIFICATION"))
    return { color: "bg-pink-500", icon: Bell, label: type.replace(/_/g, " ") };
  return { color: "bg-gray-500", icon: Activity, label: type };
}

// ==========================================
// Dashboard Page
// ==========================================
export default function DashboardPage() {
  const { events, connected, clearEvents } = useEventStream();
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [s, h] = await Promise.all([
        ordersApi.getStats().catch(() => null),
        healthApi.check().catch(() => null),
      ]);
      if (s) setStats(s);
      if (h) setHealth(h);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Refetch stats when new order events arrive
  useEffect(() => {
    if (events.length > 0 && events[0].type.startsWith("ORDER_")) {
      fetchStats();
    }
  }, [events, fetchStats]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Real-Time Dashboard"
        description="Giám sát hệ thống xử lý đơn hàng theo thời gian thực"
      />

      {/* Connection Status */}
      <div className="flex items-center gap-4">
        <Badge
          variant={connected ? "default" : "destructive"}
          className="gap-1.5 px-3 py-1"
        >
          {connected ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          {connected ? "Đang kết nối Event Stream" : "Mất kết nối"}
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          {events.length} events
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Tổng đơn hàng"
          value={stats?.total ?? "-"}
          icon={Package}
          loading={loadingStats}
        />
        <StatsCard
          title="Doanh thu"
          value={
            stats ? `${(stats.totalRevenue / 1_000_000).toFixed(1)}M ₫` : "-"
          }
          icon={CreditCard}
          loading={loadingStats}
        />
        <StatsCard
          title="Đã xác nhận"
          value={stats?.byStatus?.CONFIRMED ?? 0}
          icon={CheckCircle}
          loading={loadingStats}
        />
        <StatsCard
          title="Đã hủy"
          value={stats?.byStatus?.CANCELLED ?? 0}
          icon={XCircle}
          loading={loadingStats}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Event Stream (2/3) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-lg">Live Event Stream</CardTitle>
              <CardDescription>Sự kiện từ tất cả microservices</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStats}
                disabled={loadingStats}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingStats ? "animate-spin" : ""}`}
                />
              </Button>
              <Button variant="outline" size="sm" onClick={clearEvents}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[460px] pr-4">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Clock className="mb-3 h-10 w-10" />
                  <p>Chưa có sự kiện. Hãy tạo đơn hàng để xem event stream!</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {events.map((evt) => (
                    <EventItem key={evt.id + evt.timestamp} event={evt} />
                  ))}
                </AnimatePresence>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Service Health (1/3) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Service Health</CardTitle>
            <CardDescription>Trạng thái các microservices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {health?.services ? (
              health.services.map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{svc.name}</span>
                  </div>
                  <Badge
                    variant={
                      svc.status === "healthy" ? "default" : "destructive"
                    }
                    className="text-xs"
                  >
                    {svc.status}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Server className="mb-2 h-8 w-8" />
                <p className="text-sm">Đang tải...</p>
              </div>
            )}

            <Separator />

            {/* Order Status Breakdown */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Phân bổ trạng thái đơn</p>
              {stats?.byStatus ? (
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
                <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==========================================
// Sub-components
// ==========================================
function StatsCard({
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
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="rounded-lg bg-primary/10 p-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{loading ? "..." : value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EventItem({ event }: { event: SSEEvent }) {
  const style = getEventStyle(event.type);
  const Icon = style.icon;
  const time = new Date(event.timestamp).toLocaleTimeString("vi-VN");

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className="mb-2 flex items-start gap-3 rounded-lg border p-3"
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${style.color}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{style.label}</p>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Source: {event.source} · ID: {event.correlationId?.slice(0, 8)}...
        </p>
      </div>
    </motion.div>
  );
}
