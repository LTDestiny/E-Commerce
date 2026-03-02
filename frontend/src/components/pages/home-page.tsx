"use client";

import { motion } from "motion/react";
import {
  LayoutDashboard,
  Network,
  Zap,
  Server,
  Database,
  Radio,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { AnimatedCard } from "@/components/shared/animated-card";
import { RatingStars } from "@/components/shared/rating-stars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SERVICES, CHARACTERISTICS, TECH_STACK } from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section>
        <PageHeader
          title="Hệ Thống Xử Lý Đơn Hàng Real-Time"
          description="Event-Driven Architecture cho nền tảng thương mại điện tử"
          icon={<LayoutDashboard className="h-6 w-6 text-primary" />}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border bg-gradient-to-br from-primary/5 via-primary/10 to-transparent p-6"
        >
          <p className="text-lg leading-relaxed text-muted-foreground">
            Hệ thống xử lý đơn hàng cho nền tảng thương mại điện tử, khi khách
            hàng đặt hàng cần thực hiện <strong>đồng thời</strong>: cập nhật
            kho, xử lý thanh toán, gửi xác nhận và sắp xếp vận chuyển.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">Real-time Processing</Badge>
            <Badge variant="secondary">High Scalability</Badge>
            <Badge variant="secondary">Fault Tolerance</Badge>
            <Badge variant="secondary">Event-Driven</Badge>
          </div>
        </motion.div>
      </section>

      <Separator />

      {/* Architecture Overview */}
      <section>
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
          <Network className="h-6 w-6 text-primary" />
          Kiến Trúc Hệ Thống
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <AnimatedCard
            title="Event-Driven Architecture"
            delay={0}
            icon={<Zap className="h-5 w-5 text-orange-500" />}
          >
            <p className="text-sm text-muted-foreground">
              Kiến trúc chính. Các tác vụ độc lập chạy song song, xử lý
              real-time với khả năng mở rộng cao.
            </p>
          </AnimatedCard>

          <AnimatedCard
            title="Microservices"
            delay={0.1}
            icon={<Server className="h-5 w-5 text-blue-500" />}
          >
            <p className="text-sm text-muted-foreground">
              5 microservices độc lập giao tiếp qua Event Bus, scale từng
              service riêng biệt.
            </p>
          </AnimatedCard>

          <AnimatedCard
            title="CQRS"
            delay={0.2}
            icon={<Database className="h-5 w-5 text-green-500" />}
          >
            <p className="text-sm text-muted-foreground">
              Tách biệt việc ghi và đọc. Event Store lưu trữ tất cả events cho
              audit và replay.
            </p>
          </AnimatedCard>
        </div>

        <div className="mt-4 flex justify-end">
          <Link href="/architecture">
            <Button variant="outline" className="gap-2">
              Xem chi tiết <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Separator />

      {/* Services */}
      <section>
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
          <Server className="h-6 w-6 text-primary" />
          Microservices
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SERVICES.map((service, i) => (
            <AnimatedCard key={service.name} delay={i * 0.08}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${service.color}`} />
                  <h3 className="font-semibold text-sm">{service.name}</h3>
                </div>
                <Badge variant="outline" className="text-xs">
                  {service.tech}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {service.description}
                </p>
              </div>
            </AnimatedCard>
          ))}
        </div>
      </section>

      <Separator />

      {/* Architecture Characteristics */}
      <section>
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold">
          <Radio className="h-6 w-6 text-primary" />
          Architecture Characteristics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHARACTERISTICS.map((char, i) => (
            <AnimatedCard key={char.name} delay={i * 0.06}>
              <div className="space-y-2">
                <h3 className="font-semibold">{char.name}</h3>
                <RatingStars rating={char.rating} />
                <p className="text-xs text-muted-foreground">
                  {char.description}
                </p>
              </div>
            </AnimatedCard>
          ))}
        </div>
      </section>

      <Separator />

      {/* Tech Stack */}
      <section>
        <h2 className="mb-6 text-2xl font-bold">Công Nghệ Sử Dụng</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TECH_STACK.map((item, i) => (
            <motion.div
              key={item.category}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-lg border p-3 text-center transition-colors hover:bg-muted/50"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {item.category}
              </p>
              <p className="mt-1 text-sm font-bold">{item.tech}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.role}
              </p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
