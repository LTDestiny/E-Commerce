// ==========================================
// Payment Service - Entry Point
// ==========================================

import express from "express";
import cors from "cors";
import {
  RedisEventBus,
  KafkaEventBus,
  createEvent,
  checkKafkaConnectivity,
} from "@ecommerce/shared";
import { config } from "./config";
import { createPaymentRoutes } from "./routes/payment.routes";
import { registerEventHandlers } from "./handlers/payment.handler";
import { prisma } from "./lib/prisma";
import { PrismaEventStore } from "./lib/event-store";

async function ensurePaymentAdminData() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'SEPAY'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "qrCode" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "transferContent" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3)`);

  const count = await prisma.payment.count();
  if (count > 0) return;

  const demoPayments = [
    { orderId: "order-ts-9421", customerId: "user-customer-jordan", amount: 1205800, method: "STRIPE", status: "COMPLETED", transactionId: "ch_3Nf9Z8L2o9X" },
    { orderId: "order-ts-9420", customerId: "user-customer-sarah", amount: 499000, method: "PAYPAL", status: "PENDING", transactionId: "txn_55029411" },
    { orderId: "order-ts-9419", customerId: "user-customer-arthur", amount: 2840500, method: "BANK_TRANSFER", status: "COMPLETED", transactionId: "bnk_884210" },
    { orderId: "order-ts-9418", customerId: "user-customer-liam", amount: 120000, method: "SEPAY_QR", status: "FAILED", transactionId: null },
  ];

  for (const payment of demoPayments) {
    await prisma.payment.create({
      data: {
        ...payment,
        currency: "VND",
        provider: payment.method === "STRIPE" ? "Stripe Gateway" : "SEPAY",
        idempotencyKey: `admin-seed-${payment.orderId}`,
        paidAt: payment.status === "COMPLETED" ? new Date() : null,
      },
    });
  }

  console.log(`[${config.serviceName}] Seeded ${demoPayments.length} admin demo payments`);
}

async function main() {
  await prisma.$connect();
  await ensurePaymentAdminData();
  console.log(`[${config.serviceName}] Connected to PostgreSQL`);

  const app = express();
  app.use(cors({ origin: config.cors.origin }));
  app.use(
    config.sepay.webhookPath,
    express.raw({ type: "application/json" }),
  );
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

  app.use("/api/payments", createPaymentRoutes(eventBus, eventStore));

  // Start Payment Expiration Cron Job (runs every 5 minutes)
  setInterval(async () => {
    try {
      const now = new Date();
      const expiredPayments = await prisma.payment.findMany({
        where: {
          status: "PENDING",
          expiredAt: { lt: now },
        },
      });

      for (const payment of expiredPayments) {
        console.log(`[PaymentService Cron] Expiring payment ${payment.id} for order ${payment.orderId}`);
        
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "EXPIRED" },
        });

        const failEvent = createEvent<any>(
          "PAYMENT_FAILED",
          config.serviceName,
          {
            orderId: payment.orderId,
            paymentId: payment.id,
            reason: "Payment expired (expiredAt passed)",
            retryable: false,
          },
          payment.idempotencyKey,
          {
            provider: "SEPAY",
            status: "EXPIRED",
          }
        );

        await eventStore.append(failEvent);
        await eventBus.publish("payment.failed", failEvent);
      }
    } catch (e) {
      console.error("[PaymentService Cron] Error in payment expire cron job:", e);
    }
  }, 5 * 60 * 1000);

  app.get("/health", async (_req, res) => {
    try {
      let kafkaConnected = null;
      if (process.env.KAFKA_BOOTSTRAP_SERVERS) {
        kafkaConnected = await checkKafkaConnectivity(
          process.env.KAFKA_BOOTSTRAP_SERVERS,
        ).catch(() => false);
      }

      res.json({
        service: config.serviceName,
        status: "healthy",
        uptime: process.uptime(),
        kafka: kafkaConnected,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[${config.serviceName}] Health check failed:`, error);
      res.status(503).json({
        service: config.serviceName,
        status: "degraded",
        uptime: process.uptime(),
        kafka: false,
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.listen(config.port, () => {
    console.log(
      `💳 ${config.serviceName} running on http://localhost:${config.port}`,
    );
  });

  process.on("SIGTERM", async () => {
    await eventBus.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
