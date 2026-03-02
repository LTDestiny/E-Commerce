"use client";

import { motion } from "motion/react";
import { Network, Zap, Server, Database, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { AnimatedCard } from "@/components/shared/animated-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SERVICES } from "@/lib/constants";

export default function ArchitecturePage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Kiến Trúc Hệ Thống"
        description="Event-Driven Architecture + Microservices + CQRS"
        icon={<Network className="h-6 w-6 text-primary" />}
      />

      <Tabs defaultValue="eda" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="eda" className="gap-2">
            <Zap className="h-4 w-4" />
            EDA
          </TabsTrigger>
          <TabsTrigger value="microservices" className="gap-2">
            <Server className="h-4 w-4" />
            Microservices
          </TabsTrigger>
          <TabsTrigger value="cqrs" className="gap-2">
            <Database className="h-4 w-4" />
            CQRS
          </TabsTrigger>
        </TabsList>

        {/* EDA Tab */}
        <TabsContent value="eda" className="mt-6 space-y-6">
          <AnimatedCard
            title="Event-Driven Architecture"
            icon={<Zap className="h-5 w-5 text-orange-500" />}
          >
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Kiến trúc chính của hệ thống. Tất cả giao tiếp giữa các service
                đều thông qua events trên Event Bus.
              </p>
              <div className="space-y-2">
                <h4 className="font-semibold">Lý do phù hợp:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-primary" />
                    Các tác vụ độc lập và có thể chạy song song
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-primary" />
                    Cần xử lý real-time và phản hồi ngay lập tức
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-primary" />
                    Yêu cầu khả năng mở rộng cao
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-primary" />
                    Loose coupling giữa các service
                  </li>
                </ul>
              </div>

              {/* Flow diagram */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="mb-3 text-sm font-semibold">Cách hoạt động:</h4>
                <div className="flex flex-col items-center gap-2 text-sm">
                  <Badge>1. Customer đặt hàng</Badge>
                  <ArrowRight className="h-4 w-4 rotate-90 text-primary" />
                  <Badge variant="outline">
                    2. Order Service publish &quot;Order Placed&quot;
                  </Badge>
                  <ArrowRight className="h-4 w-4 rotate-90 text-primary" />
                  <Badge variant="secondary">
                    3. Event Bus phân phối đến subscribers
                  </Badge>
                  <ArrowRight className="h-4 w-4 rotate-90 text-primary" />
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge className="bg-green-500">Inventory</Badge>
                    <Badge className="bg-orange-500">Payment</Badge>
                    <Badge className="bg-red-500">Notification</Badge>
                  </div>
                  <ArrowRight className="h-4 w-4 rotate-90 text-primary" />
                  <Badge>4. Kết quả publish lại lên Event Bus</Badge>
                </div>
              </div>
            </div>
          </AnimatedCard>
        </TabsContent>

        {/* Microservices Tab */}
        <TabsContent value="microservices" className="mt-6 space-y-6">
          <AnimatedCard
            title="Microservices Architecture"
            icon={<Server className="h-5 w-5 text-blue-500" />}
          >
            <div className="space-y-4">
              <p className="text-muted-foreground">
                5 microservices độc lập, mỗi service có database riêng, giao
                tiếp qua Event Bus.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SERVICES.map((service, i) => (
                  <motion.div
                    key={service.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`rounded-lg border-l-4 ${service.borderColor} bg-muted/30 p-3`}
                  >
                    <h4 className="font-semibold">{service.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {service.tech}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  </motion.div>
                ))}
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="mb-2 text-sm font-semibold">Đặc điểm:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Database per Service pattern</li>
                  <li>• Giao tiếp qua Event Bus (không REST trực tiếp)</li>
                  <li>• Deploy, update, scale độc lập</li>
                </ul>
              </div>
            </div>
          </AnimatedCard>
        </TabsContent>

        {/* CQRS Tab */}
        <TabsContent value="cqrs" className="mt-6 space-y-6">
          <AnimatedCard
            title="CQRS"
            icon={<Database className="h-5 w-5 text-green-500" />}
          >
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Tách biệt việc ghi (Command) và đọc (Query) để tối ưu hiệu năng.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-blue-500/10 p-4">
                  <h4 className="font-semibold text-blue-500">
                    Command (Write)
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Đặt hàng mới</li>
                    <li>• Cập nhật kho hàng</li>
                    <li>• Xử lý thanh toán</li>
                    <li>• Thay đổi trạng thái đơn hàng</li>
                  </ul>
                </div>
                <div className="rounded-lg border bg-green-500/10 p-4">
                  <h4 className="font-semibold text-green-500">Query (Read)</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Xem trạng thái đơn hàng</li>
                    <li>• Kiểm tra tồn kho</li>
                    <li>• Tra cứu lịch sử giao dịch</li>
                    <li>• Dashboard & báo cáo</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Event Store</strong> lưu trữ tất cả events → hỗ trợ
                  audit trail và replay. Write DB và Read DB scale riêng biệt.
                </p>
              </div>
            </div>
          </AnimatedCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
