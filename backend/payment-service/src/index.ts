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

  await prisma.payment.deleteMany({
    where: {
      OR: [
        { id: { startsWith: "pay-ts-" } },
        { orderId: { startsWith: "order-ts-" } },
        { idempotencyKey: { startsWith: "admin-seed-" } },
      ],
    },
  });

  const methods = ["SEPAY_QR", "PAYPAL", "STRIPE", "BANK_TRANSFER"];
  const paymentStatusForIndex = (index: number) => (index >= 56 ? "FAILED" : index <= 20 ? "PENDING" : "COMPLETED");
  const demoPayments = Array.from({ length: 60 }, (_, index) => {
    const orderIndex = index + 1;
    const status = paymentStatusForIndex(orderIndex);
    return {
      id: `pay-ts-${9600 + orderIndex}`,
      orderId: `order-ts-${9600 + orderIndex}`,
      customerId: `user-flow-${String(orderIndex).padStart(2, "0")}`,
      amount: 350000 + orderIndex * 45000,
      method: methods[index % methods.length],
      status,
      transactionId: status === "COMPLETED" ? `PAID-TS-${9600 + orderIndex}` : null,
    };
  });

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

  console.log(`[${config.serviceName}] Ensured ${demoPayments.length} admin demo payments`);
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
  await ensurePaymentAdminData();
  console.log(`[${config.serviceName}] Connected to PostgreSQL`);

  const app = express();
  app.use(cors({ origin: config.cors.origin }));
  app.use(
    config.sepay.webhookPath,
    express.raw({ type: "*/*" }),
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
        console.log(`[PaymentService Cron] Failing expired payment ${payment.id} for order ${payment.orderId}`);

        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
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
            status: "FAILED",
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
