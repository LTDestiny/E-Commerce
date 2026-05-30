// ==========================================
// Inventory Service - Entry Point
// ==========================================

import express from "express";
import cors from "cors";
import { RedisEventBus } from "@ecommerce/shared";
import { config } from "./config";
import { createInventoryRoutes } from "./routes/inventory.routes";
import { registerEventHandlers } from "./handlers/inventory.handler";
import { prisma } from "./lib/prisma";
import { PrismaEventStore } from "./lib/event-store";
import { inventoryRepository } from "./models/inventory.repository";
import { disconnectCache } from "./lib/cache";

async function main() {
  await prisma.$connect();
  console.log(`[${config.serviceName}] Connected to PostgreSQL`);

  // Seed inventory products if table is empty
  await inventoryRepository.seedIfEmpty();

  const app = express();
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json());

  const eventBus = new RedisEventBus(config.redis.url, config.serviceName);
  const eventStore = new PrismaEventStore(prisma);

  registerEventHandlers(eventBus, eventStore);

  app.use("/api/inventory", createInventoryRoutes(eventBus, eventStore));

  app.get("/health", (_req, res) => {
    res.json({
      service: config.serviceName,
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
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
