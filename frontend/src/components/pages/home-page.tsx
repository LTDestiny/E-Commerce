"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Package,
  Radio,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SERVICES, PATTERNS, TECH_STACK } from "@/lib/constants";
import { PRODUCT_CATALOG, STORE, formatVND } from "@/lib/commerce";

const workflow = [
  { label: "Đặt hàng", icon: ShoppingCart, tone: "bg-blue-500" },
  { label: "Giữ tồn kho", icon: Warehouse, tone: "bg-green-500" },
  { label: "Thanh toán", icon: CreditCard, tone: "bg-orange-500" },
  { label: "Xác nhận", icon: CheckCircle2, tone: "bg-emerald-500" },
  { label: "Giao hàng", icon: Truck, tone: "bg-purple-500" },
  { label: "Thông báo", icon: Radio, tone: "bg-red-500" },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="grid min-h-[560px] items-center gap-8 py-4 lg:grid-cols-[1fr_0.92fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Badge variant="secondary" className="w-fit gap-2">
            <Activity className="h-3.5 w-3.5" />
            Event-driven ecommerce
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {STORE.name}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Web thương mại điện tử máy tính và công nghệ với catalog, giỏ
              hàng, checkout, xử lý đơn theo Saga, cập nhật kho, thanh toán,
              vận chuyển, thông báo và dashboard real-time.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/orders">
                Bắt đầu mua hàng <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/dashboard">
                Xem dashboard <Activity className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid max-w-2xl grid-cols-3 gap-3 pt-2">
            {[
              ["5", "microservices"],
              ["SSE", "real-time stream"],
              ["Saga", "workflow"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg border bg-card p-4">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative min-h-[360px] overflow-hidden rounded-lg border bg-muted"
        >
          <Image
            src="/commerce-hero.png"
            alt="Bộ sản phẩm công nghệ trong cửa hàng thương mại điện tử"
            fill
            priority
            className="object-cover"
            sizes="(min-width: 1024px) 46vw, 100vw"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Catalog công nghệ</Badge>
              <Badge variant="secondary">Checkout real-time</Badge>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold">Sản phẩm nổi bật</h2>
            <p className="text-muted-foreground">
              Dữ liệu catalog khớp với inventory seed của backend.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/orders">Mở giỏ hàng</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PRODUCT_CATALOG.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="h-full rounded-lg py-4">
                <CardContent className="space-y-4 px-4">
                  <div
                    className={`flex aspect-[4/3] items-center justify-center rounded-md bg-gradient-to-br ${product.accentClass}`}
                  >
                    <Package className="h-10 w-10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Badge variant="outline">{product.category}</Badge>
                    <h3 className="min-h-10 text-sm font-semibold leading-5">
                      {product.name}
                    </h3>
                    <p className="text-sm font-bold">
                      {formatVND(product.price)}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {product.shortDescription}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <Separator />

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">Workflow xử lý đơn hàng</h2>
          <p className="text-muted-foreground">
            Một đơn hàng kích hoạt chuỗi event qua Redis Pub/Sub và các service
            tự phản ứng theo Saga choreography.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          {workflow.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="rounded-lg border bg-card p-4">
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-md text-white ${step.tone}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bước {index + 1}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Microservices trong project</CardTitle>
            <CardDescription>
              Các service backend hiện có được dùng trực tiếp qua API Gateway.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {SERVICES.map((service) => (
              <div key={service.name} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${service.color}`}
                  />
                  <p className="font-semibold">{service.name}</p>
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  {service.tech}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {service.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Pattern đã áp dụng
            </CardTitle>
            <CardDescription>
              Mỗi pattern gắn với một phần cụ thể của luồng mua hàng.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PATTERNS.slice(0, 4).map((pattern) => (
              <div key={pattern.name} className="rounded-lg border p-3">
                <p className="text-sm font-semibold">{pattern.name}</p>
                <p className="text-xs text-muted-foreground">
                  {pattern.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Stack triển khai</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TECH_STACK.map((item) => (
            <div key={item.category} className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {item.category}
              </p>
              <p className="mt-1 font-semibold">{item.tech}</p>
              <p className="text-xs text-muted-foreground">{item.role}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
