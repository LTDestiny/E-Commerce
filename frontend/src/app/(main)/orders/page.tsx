"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Laptop,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  UserRound,
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
  inventoryApi,
  ordersApi,
  type CreateOrderPayload,
  type InventoryItem,
  type Order,
  type StoredEvent,
} from "@/lib/api";
import {
  PRODUCT_CATALOG,
  createCustomerId,
  formatVND,
  getProductMeta,
} from "@/lib/commerce";

type Cart = Record<string, number>;

const DEFAULT_ADDRESS = {
  fullName: "Nguyễn Văn A",
  phone: "0901234567",
  street: "12 Nguyễn Văn Bảo",
  city: "TP. Hồ Chí Minh",
  state: "Gò Vấp",
  zipCode: "700000",
  country: "Việt Nam",
};

const categories = ["Tất cả", ...new Set(PRODUCT_CATALOG.map((p) => p.category))];

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
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [eventsByOrder, setEventsByOrder] = useState<Record<string, StoredEvent[]>>(
    {},
  );
  const [cart, setCart] = useState<Cart>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [customer, setCustomer] = useState({
    name: DEFAULT_ADDRESS.fullName,
    phone: DEFAULT_ADDRESS.phone,
    street: DEFAULT_ADDRESS.street,
    city: DEFAULT_ADDRESS.city,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, ords] = await Promise.all([
        inventoryApi.list().catch(() => []),
        ordersApi.list().catch(() => []),
      ]);
      setInventory(inv);
      setOrders(ords);
      setApiMessage(inv.length === 0 ? "Backend chưa chạy hoặc chưa seed kho." : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, 5000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  const catalog = useMemo(() => {
    const stockById = new Map(inventory.map((item) => [item.productId, item]));
    return PRODUCT_CATALOG.map((product) => ({
      ...product,
      stock: stockById.get(product.id),
    })).filter((product) => {
      const matchesCategory = category === "Tất cả" || product.category === category;
      const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [category, inventory, query]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, quantity]) => {
          const product = getProductMeta(productId);
          const stock = inventory.find((item) => item.productId === productId);
          return { ...product, quantity, stock };
        })
        .filter((item) => item.quantity > 0),
    [cart, inventory],
  );

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const updateCart = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId] ?? 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const placeOrder = async () => {
    if (cartItems.length === 0) return;
    setPlacing(true);
    setApiMessage(null);
    try {
      const payload: CreateOrderPayload = {
        customerId: createCustomerId(),
        items: cartItems.map((item) => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        shippingAddress: {
          fullName: customer.name,
          phone: customer.phone,
          street: customer.street,
          city: customer.city,
          state: DEFAULT_ADDRESS.state,
          zipCode: DEFAULT_ADDRESS.zipCode,
          country: DEFAULT_ADDRESS.country,
        },
      };
      const order = await ordersApi.create(payload);
      setCart({});
      setExpandedOrder(order.id);
      await fetchData();
      await loadOrderEvents(order.id);
      setApiMessage(`Đã tạo đơn ${order.id.slice(0, 8)}. Saga đang xử lý.`);
    } catch (error) {
      setApiMessage(
        error instanceof Error
          ? error.message
          : "Không thể tạo đơn. Hãy kiểm tra backend.",
      );
    } finally {
      setPlacing(false);
    }
  };

  const loadOrderEvents = async (orderId: string) => {
    const events = await ordersApi.getEvents(orderId).catch(() => []);
    setEventsByOrder((prev) => ({ ...prev, [orderId]: events }));
  };

  const toggleOrder = async (orderId: string) => {
    const next = expandedOrder === orderId ? null : orderId;
    setExpandedOrder(next);
    if (next && !eventsByOrder[orderId]) await loadOrderEvents(orderId);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mua máy tính và thiết bị công nghệ"
        description="Catalog, giỏ hàng, checkout và theo dõi trạng thái đơn theo workflow Saga real-time."
        icon={<Laptop className="h-6 w-6 text-primary" />}
      />

      {apiMessage && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{apiMessage}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card className="rounded-lg">
            <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_auto]">
              <div className="flex items-center gap-2 rounded-md border px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm laptop, điện thoại, tai nghe..."
                  className="h-10 w-full bg-transparent text-sm outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((item) => (
                  <Button
                    key={item}
                    variant={category === item ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={fetchData}
                  disabled={loading}
                  title="Tải lại dữ liệu"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {catalog.map((product, index) => {
              const quantity = cart[product.id] ?? 0;
              const available = product.stock?.availableStock ?? 0;
              const canAdd = product.stock ? quantity < available : false;

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Card className="h-full rounded-lg py-5">
                    <CardContent className="space-y-4 px-5">
                      <div className="flex gap-4">
                        <div
                          className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${product.accentClass}`}
                        >
                          <Package className="h-10 w-10 text-white" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Badge variant="outline">{product.category}</Badge>
                              <h3 className="mt-2 font-semibold leading-5">
                                {product.name}
                              </h3>
                            </div>
                            <Badge
                              variant={
                                available > 10
                                  ? "secondary"
                                  : available > 0
                                    ? "outline"
                                    : "destructive"
                              }
                            >
                              {product.stock ? `Còn ${available}` : "Offline"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {product.shortDescription}
                          </p>
                          <p className="font-bold">{formatVND(product.price)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {product.specs.map((spec) => (
                          <Badge key={spec} variant="secondary">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => updateCart(product.id, -1)}
                            disabled={quantity === 0}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-semibold">
                            {quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => updateCart(product.id, 1)}
                            disabled={!canAdd}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          onClick={() => updateCart(product.id, 1)}
                          disabled={!canAdd}
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Thêm
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Giỏ hàng
                {cartCount > 0 && <Badge>{cartCount}</Badge>}
              </CardTitle>
              <CardDescription>
                Đơn hàng sẽ đi qua Inventory, Payment, Shipping và Notification.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cartItems.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Chưa có sản phẩm trong giỏ.
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} x {formatVND(item.price)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">
                        {formatVND(item.quantity * item.price)}
                      </p>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Tổng cộng</span>
                    <span>{formatVND(cartTotal)}</span>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <UserRound className="h-4 w-4" />
                  Thông tin giao hàng
                </div>
                <input
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  placeholder="Họ tên"
                />
                <input
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  placeholder="Số điện thoại"
                />
                <input
                  value={customer.street}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, street: e.target.value }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  placeholder="Địa chỉ"
                />
                <input
                  value={customer.city}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, city: e.target.value }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  placeholder="Tỉnh/thành"
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={placeOrder}
                disabled={cartItems.length === 0 || placing}
              >
                {placing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {placing ? "Đang tạo đơn..." : "Checkout"}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card className="rounded-lg">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Đơn hàng gần đây</CardTitle>
            <CardDescription>
              Mở từng đơn để xem sản phẩm và event timeline được lưu trong Event
              Store.
            </CardDescription>
          </div>
          <Badge variant="outline">{orders.length} đơn</Badge>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[560px] pr-3">
            {orders.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                Chưa có đơn hàng. Hãy checkout một giỏ hàng để kích hoạt Saga.
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {[...orders].reverse().map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    expanded={expandedOrder === order.id}
                    events={eventsByOrder[order.id] ?? []}
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

function OrderRow({
  order,
  expanded,
  events,
  onToggle,
}: {
  order: Order;
  expanded: boolean;
  events: StoredEvent[];
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
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
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
              <p className="text-sm font-semibold">Event timeline</p>
              {events.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Chưa tải được timeline hoặc backend chưa có event cho đơn này.
                </p>
              ) : (
                events.map((stored) => (
                  <div
                    key={stored.sequenceNumber}
                    className="flex gap-3 rounded-md border p-3"
                  >
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {stored.event.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stored.event.source} ·{" "}
                        {new Date(stored.event.timestamp).toLocaleTimeString(
                          "vi-VN",
                        )}
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
