// ==========================================
// Order Service - Entry Point
// ==========================================

import express from "express";
import cors from "cors";
import { RedisEventBus } from "@ecommerce/shared";
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

  // Event infrastructure
  const eventBus = new RedisEventBus(config.redis.url, config.serviceName);
  const eventStore = new PrismaEventStore(prisma);

  // Register event handlers (Saga Pattern - Choreography)
  registerEventHandlers(eventBus, eventStore);

  // Routes
  app.use("/api/orders", createOrderRoutes(eventBus, eventStore));

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      service: config.serviceName,
      status: "healthy",
      uptime: process.uptime(),
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
