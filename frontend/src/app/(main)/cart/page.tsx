"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  UserRound,
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
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import {
  getStoredUser,
  inventoryApi,
  ordersApi,
  type CreateOrderPayload,
  type InventoryItem,
} from "@/lib/api";
import { createCustomerId, formatVND } from "@/lib/commerce";
import {
  CART_UPDATED_EVENT,
  getCartItems,
  getCartTotal,
  readCart,
  updateCartQuantity,
  writeCart,
  type Cart,
} from "@/lib/cart";

const CHECKOUT_COOLDOWN_MS = 3000;
const DEFAULT_ADDRESS = {
  fullName: "Nguyễn Văn A",
  phone: "0901234567",
  street: "12 Nguyễn Văn Bảo",
  city: "TP. Hồ Chí Minh",
  state: "Gò Vấp",
  zipCode: "700000",
  country: "Việt Nam",
};

export default function CartPage() {
  const [cart, setCart] = useState<Cart>({});
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [placing, setPlacing] = useState(false);
  const [checkoutCooldown, setCheckoutCooldown] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const checkoutLockRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customer, setCustomer] = useState(DEFAULT_ADDRESS);

  const syncCart = useCallback(() => setCart(readCart()), []);

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCustomer((current) => ({ ...current, fullName: user.name }));
    }

    syncCart();
    window.addEventListener(CART_UPDATED_EVENT, syncCart);
    window.addEventListener("storage", syncCart);

    inventoryApi.list().then(setInventory).catch(() => setInventory([]));

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, syncCart);
      window.removeEventListener("storage", syncCart);
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, [syncCart]);

  const cartItems = useMemo(() => getCartItems(cart), [cart]);
  const cartTotal = useMemo(() => getCartTotal(cart), [cart]);
  const stockById = useMemo(
    () => new Map(inventory.map((item) => [item.productId, item])),
    [inventory],
  );

  function setQuantity(productId: string, quantity: number) {
    const next = updateCartQuantity(cart, productId, quantity);
    setCart(next);
    writeCart(next);
  }

  async function placeOrder() {
    if (cartItems.length === 0 || checkoutLockRef.current) return;

    checkoutLockRef.current = true;
    setPlacing(true);
    setMessage(null);

    try {
      const user = getStoredUser();
      const payload: CreateOrderPayload = {
        customerId: user?.id ?? createCustomerId(),
        items: cartItems.map((item) => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        shippingAddress: customer,
      };

      const order = await ordersApi.create(payload);
      writeCart({});
      setCart({});
      setMessage(
        `Đã tạo đơn ${order.id.slice(0, 8)}. Bạn có thể theo dõi trong trang Đơn hàng.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể tạo đơn. Hãy kiểm tra backend.",
      );
    } finally {
      setPlacing(false);
      setCheckoutCooldown(true);
      cooldownRef.current = setTimeout(() => {
        checkoutLockRef.current = false;
        setCheckoutCooldown(false);
      }, CHECKOUT_COOLDOWN_MS);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Giỏ hàng"
        description="Kiểm tra sản phẩm, thông tin giao hàng và tạo đơn qua API Gateway với JWT."
        icon={<ShoppingCart className="h-6 w-6 text-primary" />}
      />

      {message && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Sản phẩm đã chọn</CardTitle>
            <CardDescription>
              Số lượng được lưu trong trình duyệt và đồng bộ với thanh menu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cartItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center">
                <p className="font-medium">Giỏ hàng đang trống</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Chọn sản phẩm để bắt đầu checkout.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/products">Mua sắm ngay</Link>
                </Button>
              </div>
            ) : (
              cartItems.map((item) => {
                const stock = stockById.get(item.id);
                const available = stock?.availableStock;

                return (
                  <div
                    key={item.id}
                    className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{item.name}</h2>
                        <Badge variant="outline">{item.category}</Badge>
                        <Badge variant={available ? "secondary" : "outline"}>
                          {available === undefined ? "Đang kiểm tra kho" : `Còn ${available}`}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.shortDescription}
                      </p>
                      <p className="mt-2 font-bold">{formatVND(item.price)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setQuantity(item.id, item.quantity + 1)}
                          disabled={available !== undefined && item.quantity >= available}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setQuantity(item.id, 0)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5" />
                Giao hàng
              </CardTitle>
              <CardDescription>
                Thông tin này được lưu vào đơn hàng.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["fullName", "Họ tên"],
                ["phone", "Số điện thoại"],
                ["street", "Địa chỉ"],
                ["city", "Tỉnh/thành"],
                ["state", "Quận/huyện"],
                ["zipCode", "Mã bưu chính"],
              ].map(([field, label]) => (
                <input
                  key={field}
                  value={customer[field as keyof typeof customer]}
                  onChange={(event) =>
                    setCustomer((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  placeholder={label}
                />
              ))}

              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tạm tính</span>
                  <span>{formatVND(cartTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phí vận chuyển</span>
                  <span>Miễn phí</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Tổng cộng</span>
                  <span>{formatVND(cartTotal)}</span>
                </div>
              </div>
              <Button
                className="w-full"
                size="lg"
                disabled={cartItems.length === 0 || placing || checkoutCooldown}
                onClick={placeOrder}
              >
                {placing || checkoutCooldown ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {placing
                  ? "Đang tạo đơn..."
                  : checkoutCooldown
                    ? "Chờ chống spam..."
                    : "Đặt hàng"}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
