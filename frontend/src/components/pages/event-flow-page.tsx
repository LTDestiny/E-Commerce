"use client";

import { motion } from "motion/react";
import { Workflow, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { AnimatedCard } from "@/components/shared/animated-card";
import { Badge } from "@/components/ui/badge";
import { EVENT_CATEGORIES } from "@/lib/constants";

const FLOW_STEPS = [
  {
    step: 1,
    title: "Order Placed",
    description: "Customer đặt hàng → Order Service publish event",
    color: "bg-green-500",
    data: "{orderId, userId, items}",
  },
  {
    step: 2,
    title: "Parallel Processing",
    description: "3 services xử lý đồng thời: Inventory, Payment, Notification",
    color: "bg-blue-500",
    data: "Check stock, Process payment, Send notification",
  },
  {
    step: 3,
    title: "Order Confirmed",
    description:
      "Order Service nhận Inventory Updated + Payment Processed → confirm",
    color: "bg-yellow-500",
    data: "Both events validated",
  },
  {
    step: 4,
    title: "Shipping Scheduled",
    description: "Shipping Service nhận Order Confirmed → sắp xếp vận chuyển",
    color: "bg-purple-500",
    data: "Tracking info generated",
  },
  {
    step: 5,
    title: "Process Complete",
    description: "Customer nhận thông báo hoàn tất đơn hàng",
    color: "bg-emerald-500",
    data: "Order complete notification",
  },
];

export default function EventFlowPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Event Flow — Luồng Xử Lý"
        description="Sequence diagram: từ đặt hàng đến hoàn tất"
        icon={<Workflow className="h-6 w-6 text-primary" />}
      />

      {/* Flow Steps */}
      <section>
        <h2 className="mb-6 text-xl font-bold">Happy Path</h2>
        <div className="space-y-4">
          {FLOW_STEPS.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-bold ${step.color}`}
                >
                  {step.step}
                </div>
                <div className="flex-1 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{step.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {step.data}
                  </Badge>
                </div>
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <div className="ml-5 flex justify-start py-1">
                  <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Event Categories */}
      <section>
        <h2 className="mb-6 text-xl font-bold">Event Categories</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EVENT_CATEGORIES.map((cat, i) => (
            <AnimatedCard key={cat.category} delay={i * 0.08}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${cat.color}`} />
                  <h3 className="font-semibold text-sm">{cat.category}</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cat.events.map((event) => (
                    <Badge key={event} variant="secondary" className="text-xs">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
            </AnimatedCard>
          ))}
        </div>
      </section>
    </div>
  );
}
