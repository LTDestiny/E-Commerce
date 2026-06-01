// ==========================================
// Inventory Service - Entry Point
// ==========================================

import express from "express";
import cors from "cors";
import {
  RedisEventBus,
  KafkaEventBus,
  checkKafkaConnectivity,
} from "@ecommerce/shared";
import { config } from "./config";
import { createInventoryRoutes } from "./routes/inventory.routes";
import { registerEventHandlers } from "./handlers/inventory.handler";
import { prisma } from "./lib/prisma";
import { PrismaEventStore } from "./lib/event-store";
import { inventoryRepository } from "./models/inventory.repository";
import { disconnectCache } from "./lib/cache";

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

  // Seed inventory products if table is empty
  await inventoryRepository.seedIfEmpty();

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

  app.use("/api/inventory", createInventoryRoutes(eventBus, eventStore));

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
      `📦 ${config.serviceName} running on http://localhost:${config.port}`,
    );
  });

  process.on("SIGTERM", async () => {
    await eventBus.disconnect();
    await disconnectCache();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
