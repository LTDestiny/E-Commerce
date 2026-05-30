// ==========================================
// Order Service - Entry Point
// ==========================================

import express from "express";
import cors from "cors";
import { RedisEventBus, KafkaEventBus } from "@ecommerce/shared";
import { config } from "./config";
import { createOrderRoutes } from "./routes/order.routes";
import { registerEventHandlers } from "./handlers/order.handler";
import { prisma } from "./lib/prisma";
import { PrismaEventStore } from "./lib/event-store";

async function main() {
  // Connect to PostgreSQL
  await prisma.$connect();
  console.log(`[${config.serviceName}] Connected to PostgreSQL`);

  const app = express();

  // Middleware
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json());

  // Event infrastructure (Kafka in production if configured)
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

  // Register event handlers (Saga Pattern - Choreography)
  registerEventHandlers(eventBus, eventStore);

  // Routes
  app.use("/api/orders", createOrderRoutes(eventBus, eventStore));

  // Health check
  app.get("/health", async (_req, res) => {
    let kafkaConnected = null;
    if (process.env.KAFKA_BOOTSTRAP_SERVERS) {
      try {
        const { checkKafkaConnectivity } = await import("@ecommerce/shared");
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
  });

  // Start server
  app.listen(config.port, () => {
    console.log(
      `🛒 ${config.serviceName} running on http://localhost:${config.port}`,
    );
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log(`[${config.serviceName}] Shutting down...`);
    await eventBus.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
