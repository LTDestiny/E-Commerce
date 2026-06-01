// ==========================================
// Payment Service - Entry Point
// ==========================================

import express from "express";
import cors from "cors";
import { RedisEventBus, KafkaEventBus, createEvent } from "@ecommerce/shared";
import { config } from "./config";
import { createPaymentRoutes } from "./routes/payment.routes";
import { registerEventHandlers } from "./handlers/payment.handler";
import { prisma } from "./lib/prisma";
import { PrismaEventStore } from "./lib/event-store";

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
