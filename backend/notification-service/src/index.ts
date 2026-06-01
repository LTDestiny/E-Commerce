// ==========================================
// Notification Service - Entry Point
// ==========================================

import express from "express";
import cors from "cors";
import { RedisEventBus, KafkaEventBus } from "@ecommerce/shared";
import { config } from "./config";
import { createNotificationRoutes } from "./routes/notification.routes";
import { registerEventHandlers } from "./handlers/notification.handler";
import { prisma } from "./lib/prisma";
import { PrismaEventStore } from "./lib/event-store";

async function ensureNotificationAdminData() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT false`);

  await prisma.notification.deleteMany({ where: { orderId: { startsWith: "order-ts-" } } });

  const subjects = [
    "Order created",
    "Admin new order alert",
    "Payment completed",
    "Payment failed",
    "Shipment ready",
    "Shipment delayed",
    "Shipment in transit",
    "Order delivered",
    "Order cancelled",
    "Low stock warning",
  ];
  const demoNotifications = subjects.map((subject, index) => {
    const flowIndex = index + 1;
    const sent = index >= 2;
    return {
      orderId: `order-ts-${9600 + flowIndex}`,
      customerId: `user-flow-${String(flowIndex).padStart(2, "0")}`,
      type: index === 1 ? "IN_APP" : "EMAIL",
      subject: `${subject} for TS-${9600 + flowIndex}`,
      body: `${subject} notification generated from the normalized order flow.`,
      status: sent ? "SENT" : "PENDING",
      isRead: index === 7,
      sentAt: sent ? new Date() : null,
    };
  });

  for (const item of demoNotifications) {
    await prisma.notification.create({ data: item });
  }
  console.log(`[${config.serviceName}] Ensured ${demoNotifications.length} admin demo notifications`);
}

async function main() {
  // Connect to PostgreSQL with retry
  let retries = 5;
  while (retries > 0) {
    try {
      await prisma.$connect();
      console.log(`[${config.serviceName}] Connected to PostgreSQL`);
      break;
    } catch (err) {
      retries -= 1;
      console.warn(`[${config.serviceName}] Database connection failed. Retries left: ${retries}. Error:`, err);
      if (retries === 0) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  await prisma.$connect();
  await ensureNotificationAdminData();
  console.log(`[${config.serviceName}] Connected to PostgreSQL`);

  const app = express();
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json());

  const eventBus = process.env.KAFKA_BOOTSTRAP_SERVERS
    ? new KafkaEventBus(
      process.env.KAFKA_BOOTSTRAP_SERVERS,
      config.serviceName,
      {
        maxRetries: process.env.KAFKA_MAX_RETRIES
          ? parseInt(process.env.KAFKA_MAX_RETRIES, 10)
          : undefined,
        baseDelayMs: process.env.KAFKA_RETRY_BASE_MS
          ? parseInt(process.env.KAFKA_RETRY_BASE_MS, 10)
          : undefined,
      },
    )
    : new RedisEventBus(config.redis.url, config.serviceName);
  const eventStore = new PrismaEventStore(prisma);

  registerEventHandlers(eventBus, eventStore);

  app.use("/api/notifications", createNotificationRoutes(eventBus, eventStore));

  app.get("/health", (_req, res) => {
    (async () => {
      let kafkaConnected = null;
      if (process.env.KAFKA_BOOTSTRAP_SERVERS) {
        try {
          const { checkKafkaConnectivity } =
            await import("@ecommerce/shared");
          kafkaConnected = await checkKafkaConnectivity(
            process.env.KAFKA_BOOTSTRAP_SERVERS,
          );
        } catch {
          kafkaConnected = false;
        }
      }

      res.json({
        service: config.serviceName,
        status: "healthy",
        uptime: process.uptime(),
        kafka: kafkaConnected,
        timestamp: new Date().toISOString(),
      });
    })();
  });

  app.listen(config.port, () => {
    console.log(
      `🔔 ${config.serviceName} running on http://localhost:${config.port}`,
    );
  });

  process.on("SIGTERM", async () => {
    await eventBus.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
