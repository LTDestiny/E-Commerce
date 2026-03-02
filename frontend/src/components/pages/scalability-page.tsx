"use client";

import { motion } from "motion/react";
import {
  TrendingUp,
  Server,
  Database as DatabaseIcon,
  HardDrive,
  Layers,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { AnimatedCard } from "@/components/shared/animated-card";
import { Badge } from "@/components/ui/badge";

const SCALING_STRATEGIES = [
  {
    service: "Order Service",
    instances: 3,
    trigger: "CPU > 70%",
    priority: "Standard",
    color: "bg-blue-500",
  },
  {
    service: "Inventory Service",
    instances: 2,
    trigger: "Queue Depth > 100",
    priority: "Standard",
    color: "bg-green-500",
  },
  {
    service: "Payment Service",
    instances: 4,
    trigger: "Response Time > 2s",
    priority: "High",
    color: "bg-orange-500",
  },
  {
    service: "Shipping Service",
    instances: 2,
    trigger: "Standard",
    priority: "Standard",
    color: "bg-purple-500",
  },
  {
    service: "Notification Service",
    instances: 3,
    trigger: "Queue Depth > 200",
    priority: "Standard",
    color: "bg-red-500",
  },
];

const PARTITIONS = [
  { name: "Partition 1", range: "Orders 0-999" },
  { name: "Partition 2", range: "Orders 1000-1999" },
  { name: "Partition 3", range: "Orders 2000-2999" },
  { name: "Partition 4", range: "Orders 3000+" },
];

export default function ScalabilityPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Scalability & Load Distribution"
        description="Chiến lược mở rộng và phân tải hệ thống"
        icon={<TrendingUp className="h-6 w-6 text-primary" />}
      />

      {/* Service Scaling */}
      <section>
        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold">
          <Server className="h-5 w-5 text-primary" />
          Service Auto-Scaling
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SCALING_STRATEGIES.map((s, i) => (
            <motion.div
              key={s.service}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-lg border p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${s.color}`} />
                  <h3 className="font-semibold text-sm">{s.service}</h3>
                </div>
                {s.priority === "High" && (
                  <Badge variant="destructive" className="text-xs">
                    High Priority
                  </Badge>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Instances</span>
                <div className="flex gap-1">
                  {Array.from({ length: s.instances }).map((_, j) => (
                    <motion.div
                      key={j}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.1 + j * 0.05 }}
                      className={`h-6 w-6 rounded ${s.color} flex items-center justify-center text-xs text-white font-bold`}
                    >
                      {j + 1}
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Trigger:{" "}
                <Badge variant="outline" className="text-xs">
                  {s.trigger}
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Kafka Partitioning */}
      <section>
        <AnimatedCard
          title="Kafka Partitioning"
          delay={0.3}
          icon={<Layers className="h-5 w-5 text-primary" />}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PARTITIONS.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="rounded-lg border bg-orange-500/10 p-3 text-center"
              >
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.range}</p>
              </motion.div>
            ))}
          </div>
        </AnimatedCard>
      </section>

      {/* Database Scaling */}
      <section>
        <AnimatedCard
          title="Database Scaling"
          delay={0.5}
          icon={<DatabaseIcon className="h-5 w-5 text-primary" />}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-center"
            >
              <HardDrive className="mx-auto h-8 w-8 text-red-500" />
              <p className="mt-2 font-semibold">Master DB</p>
              <Badge variant="destructive" className="mt-1">
                Write
              </Badge>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="rounded-lg border border-blue-500 bg-blue-500/10 p-4 text-center"
            >
              <HardDrive className="mx-auto h-8 w-8 text-blue-500" />
              <p className="mt-2 font-semibold">Replica 1 & 2</p>
              <Badge className="mt-1 bg-blue-500">Read</Badge>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="rounded-lg border border-yellow-500 bg-yellow-500/10 p-4 text-center"
            >
              <HardDrive className="mx-auto h-8 w-8 text-yellow-500" />
              <p className="mt-2 font-semibold">Redis Cache</p>
              <Badge className="mt-1 bg-yellow-500 text-black">Hot Data</Badge>
            </motion.div>
          </div>
        </AnimatedCard>
      </section>
    </div>
  );
}
