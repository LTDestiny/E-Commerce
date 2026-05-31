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

  const count = await prisma.notification.count();
  if (count > 0) return;

  const demoNotifications = [
    {
      orderId: "order-ts-9421",
      customerId: "user-customer-jordan",
      type: "EMAIL",
      subject: "Order TS-9421 delivered",
      body: "Your order has been delivered successfully.",
      status: "SENT",
      isRead: false,
      sentAt: new Date(),
    },
    {
      orderId: "order-ts-9420",
      customerId: "user-customer-sarah",
      type: "EMAIL",
      subject: "Payment pending for TS-9420",
      body: "Please complete payment to continue fulfillment.",
      status: "PENDING",
      isRead: false,
      sentAt: null,
    },
    {
      orderId: "order-ts-9419",
      customerId: "user-customer-arthur",
      type: "IN_APP",
      subject: "Shipment created for TS-9419",
      body: "Carrier has accepted the shipment.",
      status: "SENT",
      isRead: true,
      sentAt: new Date(),
    },
  ];

  await prisma.notification.createMany({ data: demoNotifications });
  console.log(`[${config.serviceName}] Seeded ${demoNotifications.length} admin demo notifications`);
}

async function main() {
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
