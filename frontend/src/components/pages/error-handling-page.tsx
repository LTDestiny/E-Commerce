"use client";

import { motion } from "motion/react";
import { ShieldAlert, AlertTriangle, RotateCcw, Bell } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { AnimatedCard } from "@/components/shared/animated-card";
import { Badge } from "@/components/ui/badge";

const ERROR_SCENARIOS = [
  {
    scenario: "Inventory không đủ",
    action: "Release reservations → Cancel Order",
    notification: "Out of Stock",
    color: "border-blue-500",
    icon: "📦",
  },
  {
    scenario: "Payment thất bại",
    action: "Release inventory → Cancel Order",
    notification: "Payment Failed",
    color: "border-orange-500",
    icon: "💳",
  },
  {
    scenario: "Timeout (chờ quá lâu)",
    action: "Refund payment + Release inventory → Cancel Order",
    notification: "Order Timeout",
    color: "border-yellow-500",
    icon: "⏱️",
  },
  {
    scenario: "Shipping thất bại",
    action: "Refund payment + Return inventory → Cancel Order",
    notification: "Shipping Failed",
    color: "border-purple-500",
    icon: "🚚",
  },
  {
    scenario: "Delivery thất bại",
    action: "Retry 3 lần → Full refund + Return inventory",
    notification: "Delivery Failed",
    color: "border-red-500",
    icon: "📬",
  },
];

export default function ErrorHandlingPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Xử Lý Lỗi & Compensating Transactions"
        description="Cơ chế xử lý lỗi và hoàn tác giao dịch trong Saga Pattern"
        icon={<ShieldAlert className="h-6 w-6 text-primary" />}
      />

      {/* Error Scenarios */}
      <section>
        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Kịch Bản Lỗi
        </h2>
        <div className="space-y-4">
          {ERROR_SCENARIOS.map((err, i) => (
            <motion.div
              key={err.scenario}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-lg border-l-4 ${err.color} border bg-card p-4`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{err.icon}</span>
                    <h3 className="font-semibold">{err.scenario}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RotateCcw className="h-3 w-3" />
                    {err.action}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="destructive">{err.notification}</Badge>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Retry Strategy */}
      <section>
        <AnimatedCard
          title="Retry Strategy"
          delay={0.3}
          icon={<RotateCcw className="h-5 w-5 text-primary" />}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "Attempt 1", wait: "1s", status: "Fail" },
                { label: "Attempt 2", wait: "2s", status: "Fail" },
                { label: "Attempt 3", wait: "—", status: "Fail" },
              ].map((attempt, i) => (
                <motion.div
                  key={attempt.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.15 }}
                  className="flex items-center gap-2"
                >
                  <div className="rounded-lg border bg-muted/50 p-2 text-center">
                    <p className="text-xs font-semibold">{attempt.label}</p>
                    <Badge variant="destructive" className="mt-1 text-xs">
                      {attempt.status}
                    </Badge>
                    {attempt.wait !== "—" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Wait {attempt.wait}
                      </p>
                    )}
                  </div>
                  {i < 2 && <span className="text-muted-foreground">→</span>}
                </motion.div>
              ))}
              <span className="text-muted-foreground">→</span>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="rounded-lg border border-destructive bg-destructive/10 p-2 text-center"
              >
                <p className="text-xs font-semibold">Dead Letter Queue</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Alert Admin
                </p>
              </motion.div>
            </div>
          </div>
        </AnimatedCard>
      </section>
    </div>
  );
}
