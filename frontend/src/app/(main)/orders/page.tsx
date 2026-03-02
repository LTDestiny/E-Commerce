"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingCart,
  Plus,
  Minus,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Package,
  RefreshCw,
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
import {
  ordersApi,
  inventoryApi,
  type Order,
  type InventoryItem,
  type CreateOrderPayload,
} from "@/lib/api";

// ==========================================
// Constants
// ==========================================
const DEFAULT_ADDRESS = {
  fullName: "Nguyễn Văn A",
  phone: "0901234567",
  street: "123 Lê Lợi",
  city: "Hồ Chí Minh",
  state: "HCM",
  zipCode: "700000",
  country: "Việt Nam",
};

// ==========================================
// Status badge styling
// ==========================================
function getStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "CONFIRMED":
    case "COMPLETED":
    case "DELIVERED":
      return "default";
    case "CANCELLED":
    case "FAILED":
      return "destructive";
    case "PENDING":
    case "PROCESSING":
      return "secondary";
    default:
      return "outline";
  }
}

// ==========================================
// Orders Page
// ==========================================
export default function OrdersPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, ords] = await Promise.all([
        inventoryApi.list().catch(() => []),
        ordersApi.list().catch(() => []),
      ]);
      setInventory(inv);
      setOrders(ords);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Auto-refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  // Cart helpers
  const addToCart = (productId: string) => {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const val = (prev[productId] || 0) - 1;
      if (val <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: val };
    });
  };

  const cartTotal = Object.entries(cart).reduce((sum, [pid, qty]) => {
    const item = inventory.find((i) => i.productId === pid);
    // Use a default price mapped from product names
    const price = getProductPrice(item?.productName || "");
    return sum + price * qty;
  }, 0);

  const cartItemCount = Object.values(cart).reduce((s, q) => s + q, 0);

  // Place order
  const placeOrder = async () => {
    if (cartItemCount === 0) return;
    setPlacing(true);
    try {
      const items = Object.entries(cart).map(([productId, quantity]) => {
        const inv = inventory.find((i) => i.productId === productId);
        const name = inv?.productName || productId;
        const price = getProductPrice(name);
        return {
          productId,
          productName: name,
          quantity,
          unitPrice: price,
        };
      });

      const payload: CreateOrderPayload = {
        customerId: `CUST-${Date.now().toString(36).toUpperCase()}`,
        items,
        shippingAddress: DEFAULT_ADDRESS,
      };

      await ordersApi.create(payload);
      setCart({});
      fetchData();
    } catch (error) {
      console.error("Failed to place order:", error);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Đặt Hàng"
        description="Chọn sản phẩm và đặt đơn hàng — theo dõi trạng thái real-time"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Product Catalog (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-lg">Sản phẩm</CardTitle>
                <CardDescription>Chọn sản phẩm để thêm vào giỏ</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </CardHeader>
            <CardContent>
              {inventory.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <Package className="mb-3 h-10 w-10" />
                  <p>Không thể tải sản phẩm. Hãy khởi động backend!</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {inventory.map((item) => {
                    const qty = cart[item.productId] || 0;
                    const price = getProductPrice(item.productName);
                    return (
                      <motion.div
                        key={item.productId}
                        whileHover={{ scale: 1.01 }}
                        className="rounded-lg border p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatVND(price)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              item.availableStock < 10
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            Còn {item.availableStock}
                          </Badge>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={qty === 0}
                            onClick={() => removeFromCart(item.productId)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">
                            {qty}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={qty >= item.availableStock}
                            onClick={() => addToCart(item.productId)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart & Place Order (1/3) */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5" />
                Giỏ hàng
                {cartItemCount > 0 && (
                  <Badge variant="default">{cartItemCount}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cartItemCount === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Giỏ hàng trống
                </p>
              ) : (
                <>
                  {Object.entries(cart).map(([pid, qty]) => {
                    const inv = inventory.find((i) => i.productId === pid);
                    const price = getProductPrice(inv?.productName || "");
                    return (
                      <div
                        key={pid}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">
                          {inv?.productName || pid} x{qty}
                        </span>
                        <span className="font-medium">
                          {formatVND(price * qty)}
                        </span>
                      </div>
                    );
                  })}
                  <Separator />
                  <div className="flex items-center justify-between font-semibold">
                    <span>Tổng cộng</span>
                    <span className="text-primary">{formatVND(cartTotal)}</span>
                  </div>
                </>
              )}

              <Button
                className="w-full gap-2"
                disabled={cartItemCount === 0 || placing}
                onClick={placeOrder}
              >
                {placing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                {placing ? "Đang đặt..." : "Đặt hàng"}
              </Button>
            </CardContent>
          </Card>

          {/* Shipping Address (read-only preview) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Địa chỉ giao hàng</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>{DEFAULT_ADDRESS.fullName}</p>
              <p>{DEFAULT_ADDRESS.phone}</p>
              <p>
                {DEFAULT_ADDRESS.street}, {DEFAULT_ADDRESS.city}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg">Danh sách đơn hàng</CardTitle>
            <CardDescription>
              Trạng thái tự động cập nhật mỗi 5 giây
            </CardDescription>
          </div>
          <Badge variant="outline">{orders.length} đơn</Badge>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            {orders.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <Clock className="mb-3 h-10 w-10" />
                <p>Chưa có đơn hàng nào</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {[...orders].reverse().map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    expanded={expandedOrder === order.id}
                    onToggle={() =>
                      setExpandedOrder(
                        expandedOrder === order.id ? null : order.id,
                      )
                    }
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

// ==========================================
// Sub-components
// ==========================================
function OrderRow({
  order,
  expanded,
  onToggle,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusIcon =
    order.status === "CONFIRMED" || order.status === "COMPLETED" ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : order.status === "CANCELLED" ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : (
      <Clock className="h-4 w-4 text-yellow-500" />
    );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-2 rounded-lg border"
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-3 text-left hover:bg-accent/50"
      >
        <div className="flex items-center gap-3">
          {statusIcon}
          <div>
            <p className="text-sm font-medium">{order.id.slice(0, 13)}...</p>
            <p className="text-xs text-muted-foreground">
              {new Date(order.createdAt).toLocaleString("vi-VN")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
          <span className="text-sm font-medium">
            {formatVND(order.totalAmount)}
          </span>
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
          className="border-t px-4 py-3"
        >
          <p className="mb-2 text-sm font-medium">Sản phẩm:</p>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {item.productName} × {item.quantity}
              </span>
              <span>{formatVND(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="text-sm text-muted-foreground">
            <p>Customer: {order.customerId}</p>
            <p>
              Ship to: {order.shippingAddress?.fullName},{" "}
              {order.shippingAddress?.city}
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ==========================================
// Helpers
// ==========================================
function getProductPrice(name: string): number {
  const prices: Record<string, number> = {
    "iPhone 15 Pro Max": 34990000,
    "Samsung Galaxy S24 Ultra": 31990000,
    "MacBook Pro M3": 49990000,
    "AirPods Pro 2": 6790000,
    "iPad Air M2": 18990000,
  };
  return prices[name] || 9990000;
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}
