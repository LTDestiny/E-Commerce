"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
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
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { AnimatePresence, motion } from "motion/react";
import {
  getStoredUser,
  inventoryApi,
  ordersApi,
  paymentsApi,
  type CreateOrderPayload,
  type InventoryItem,
  type Order,
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
type SepayIntentResponse = Awaited<ReturnType<typeof paymentsApi.sepayIntent>>;

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
  const router = useRouter();
  const [cart, setCart] = useState<Cart>({});
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [placing, setPlacing] = useState(false);
  const [checkoutCooldown, setCheckoutCooldown] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const checkoutLockRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customer, setCustomer] = useState(DEFAULT_ADDRESS);

  // States for interactive payment modal and VietQR
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [sepayIntentData, setSepayIntentData] = useState<SepayIntentResponse | null>(null);
  const [simulatingPayment, setSimulatingPayment] = useState<"SUCCESS" | "FAILED" | null>(null);
  const [simulationStatusMessage, setSimulationStatusMessage] = useState<string | null>(null);

  // Poll order status when payment modal is open
  useEffect(() => {
    if (!showPaymentModal || !createdOrder?.id) return;

    console.log("[CartPage] Starting to poll order status for", createdOrder.id);
    const interval = setInterval(async () => {
      try {
        const order = await ordersApi.get(createdOrder.id);
        if (
          order.status === "CONFIRMED" ||
          order.status === "PROCESSING" ||
          order.status === "COMPLETED"
        ) {
          clearInterval(interval);
          setSimulationStatusMessage("✅ Thanh toán thành công! Đơn hàng của bạn đã được ghi nhận.");
          setTimeout(() => {
            setShowPaymentModal(false);
            router.push("/orders");
          }, 3000);
        }
      } catch (err) {
        console.error("Error polling order status:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [showPaymentModal, createdOrder, router]);

  const syncCart = useCallback(() => setCart(readCart()), []);

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCustomer((current) => ({ ...current, fullName: user.name }));
    }

    syncCart();
    window.addEventListener(CART_UPDATED_EVENT, syncCart);
    window.addEventListener("auth-changed", syncCart);
    window.addEventListener("storage", syncCart);

    inventoryApi.list().then(setInventory).catch(() => setInventory([]));

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, syncCart);
      window.removeEventListener("auth-changed", syncCart);
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

  async function handleSimulatePayment(status: "SUCCESS" | "FAILED") {
    if (!sepayIntentData?.payment?.id) return;
    setSimulatingPayment(status);
    setSimulationStatusMessage(null);

    try {
      const response = await paymentsApi.sepaySimulate({
        paymentId: sepayIntentData.payment.id,
        status,
      });

      if (response && response.ok) {
        setSimulationStatusMessage(
          status === "SUCCESS"
            ? "✅ Giả lập thanh toán THÀNH CÔNG! Trạng thái đơn hàng đang được cập nhật."
            : "❌ Giả lập thanh toán THẤT BẠI! Đơn hàng đã bị hủy."
        );
      } else {
        throw new Error("Không nhận được phản hồi thành công từ simulator");
      }
    } catch (error) {
      setSimulationStatusMessage(
        `⚠️ Lỗi giả lập: ${error instanceof Error ? error.message : "Không rõ nguyên nhân"}`
      );
    } finally {
      setSimulatingPayment(null);
    }
  }

  async function placeOrder() {
    if (cartItems.length === 0 || checkoutLockRef.current) return;

    checkoutLockRef.current = true;
    setPlacing(true);
    setMessage(null);
    setCreatedOrder(null);
    setSepayIntentData(null);
    setSimulationStatusMessage(null);

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
      
      // Save order details to show in modal
      setCreatedOrder(order);

      // Call payment intent to get VietQR payload
      try {
        const intentResult = await paymentsApi.sepayIntent({
          orderId: order.id,
          customerId: order.customerId,
          amount: order.totalAmount,
        });
        if (intentResult && intentResult.ok) {
          setSepayIntentData(intentResult);
        }
      } catch (err) {
        console.error("Lỗi khi tạo payment intent:", err);
      }

      writeCart({});
      setCart({});
      setShowPaymentModal(true);

      setMessage(
        `Đã tạo đơn ${order.id.slice(0, 8)}. Vui lòng thanh toán để hoàn tất đơn hàng.`,
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

      {/* Modal Thanh toán & QR Code */}
      <AnimatePresence>
        {showPaymentModal && createdOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl backdrop-blur-md"
            >
              {/* Header */}
              <div className="border-b bg-muted/30 p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Đặt hàng thành công!</h3>
                    <p className="text-sm text-muted-foreground">
                      Mã đơn hàng: <span className="font-semibold text-primary">#{createdOrder.id}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="grid gap-6 p-6 md:grid-cols-2">
                {/* Left Column: Order Summary */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tóm tắt đơn hàng</h4>
                    <div className="max-h-[160px] overflow-y-auto space-y-2 rounded-lg border bg-muted/20 p-3">
                      {createdOrder.items.map((item) => (
                        <div key={item.productId} className="flex justify-between text-sm">
                          <span className="font-medium text-foreground max-w-[70%] truncate">
                            {item.productName} <span className="text-muted-foreground">x{item.quantity}</span>
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatVND(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1 text-sm border-t pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Người nhận:</span>
                      <span className="font-medium text-foreground">{createdOrder.shippingAddress.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Số điện thoại:</span>
                      <span className="font-medium text-foreground">{createdOrder.shippingAddress.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Giao đến:</span>
                      <span className="font-medium text-foreground text-right max-w-[65%] truncate">
                        {createdOrder.shippingAddress.street}, {createdOrder.shippingAddress.city}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between rounded-lg bg-primary/5 p-4 border border-primary/10">
                    <span className="font-bold text-foreground">Tổng cộng:</span>
                    <span className="text-xl font-extrabold text-primary">{formatVND(createdOrder.totalAmount)}</span>
                  </div>
                </div>

                {/* Right Column: QR Code & Webhook Simulator */}
                <div className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10 p-4">
                  <h4 className="text-sm font-bold text-foreground">Quét QR chuyển khoản (SePay)</h4>
                  
                  {sepayIntentData?.qrPayload ? (
                    <div className="relative overflow-hidden rounded-lg border-4 border-white shadow-md bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://img.vietqr.io/image/${sepayIntentData.qrPayload.bankName}-${sepayIntentData.qrPayload.account}-compact2.png?amount=${sepayIntentData.qrPayload.amount}&addInfo=SEPAY%20${sepayIntentData.qrPayload.orderId.slice(0, 8)}`}
                        alt="VietQR Code"
                        className="h-[180px] w-[180px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-[180px] w-[180px] flex-col items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                      <span className="text-xs">Đang tạo mã QR...</span>
                    </div>
                  )}

                  {sepayIntentData?.qrPayload && (
                    <div className="text-center text-xs text-muted-foreground">
                      <p>Ngân hàng: <span className="font-semibold text-foreground">{sepayIntentData.qrPayload.bankName}</span></p>
                      <p>Số tài khoản: <span className="font-semibold text-foreground">{sepayIntentData.qrPayload.account}</span></p>
                      <p>Nội dung: <span className="font-mono font-bold text-primary">SEPAY {sepayIntentData.qrPayload.orderId.slice(0, 8)}</span></p>
                    </div>
                  )}
                </div>
              </div>

              {/* Simulation section & Actions */}
              <div className="border-t bg-muted/20 p-6 space-y-4">
                <div className="rounded-xl border border-dashed border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                    <h5 className="text-xs font-bold text-orange-600 uppercase tracking-wider">Môi trường thử nghiệm (Developer Sandbox)</h5>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sử dụng các nút bên dưới để giả lập tín hiệu webhook thanh toán từ cổng ngân hàng SePay gửi về hệ thống của chúng tôi để tự động xác nhận đơn hàng:
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-green-600/10 hover:bg-green-600 hover:text-white border-green-600/30 text-green-600 text-xs gap-1.5"
                      disabled={!sepayIntentData || simulatingPayment !== null}
                      onClick={() => handleSimulatePayment("SUCCESS")}
                    >
                      {simulatingPayment === "SUCCESS" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Giả lập Thành công
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-red-600/10 hover:bg-red-600 hover:text-white border-red-600/30 text-red-600 text-xs gap-1.5"
                      disabled={!sepayIntentData || simulatingPayment !== null}
                      onClick={() => handleSimulatePayment("FAILED")}
                    >
                      {simulatingPayment === "FAILED" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Giả lập Thất bại
                    </Button>
                  </div>

                  {simulationStatusMessage && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-medium text-foreground mt-2"
                    >
                      {simulationStatusMessage}
                    </motion.p>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowPaymentModal(false);
                      setCreatedOrder(null);
                      setSepayIntentData(null);
                      setSimulationStatusMessage(null);
                    }}
                  >
                    Đóng
                  </Button>
                  <Button asChild>
                    <Link href="/orders">
                      Xem Lịch sử đơn hàng →
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
