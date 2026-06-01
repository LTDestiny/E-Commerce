// ==========================================
// Order Service - Entry Point
// ==========================================

import express from "express";
import cors from "cors";
import {
  RedisEventBus,
  KafkaEventBus,
  checkKafkaConnectivity,
} from "@ecommerce/shared";
import { config } from "./config";
import { createOrderRoutes } from "./routes/order.routes";
import { registerEventHandlers } from "./handlers/order.handler";
import { prisma } from "./lib/prisma";
import { PrismaEventStore } from "./lib/event-store";

async function ensureOrderAdminData() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "orderCode" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'SEPAY_QR'`);

  await prisma.order.deleteMany({ where: { id: { startsWith: "order-ts-" } } });

  const makeOrder = (
    index: number,
    name: string,
    status: string,
    paymentMethod: string,
    totalAmount: number,
  ) => ({
    id: `order-ts-${9600 + index}`,
    orderCode: `TS-${9600 + index}`,
    customerId: `user-flow-${String(index).padStart(2, "0")}`,
    status,
    paymentMethod,
    totalAmount,
    items: [
      {
        productId: `SKU-FLOW-${String(index).padStart(2, "0")}`,
        productName: `${name} Validation Bundle`,
        quantity: 1,
        unitPrice: totalAmount,
      },
    ],
    shippingAddress: {
      fullName: name,
      phone: `+84 90 555 ${9600 + index}`,
      street: `${index} Flow State Avenue`,
      city: "Ho Chi Minh City",
      state: "HCMC",
      zipCode: "700000",
      country: "Vietnam",
    },
  });

  const names = [
    "Ava", "Ben", "Chloe", "Dylan", "Emma", "Felix", "Gia", "Hugo", "Ivy", "Jack",
    "Kira", "Leo", "Mina", "Noah", "Orla", "Piper", "Quinn", "Riley", "Sage", "Theo",
    "Uma", "Vera", "Wade", "Xuan", "Yara", "Zane", "An", "Bao", "Cam", "Duc",
    "Eli", "Finn", "Gwen", "Hana", "Ian", "Jade", "Kai", "Linh", "Mai", "Nico",
    "Owen", "Paige", "Quan", "Rose", "Sean", "Tess", "Uyen", "Vinh", "Will", "Xena",
    "Yen", "Zoe", "Ari", "Bree", "Cody", "Dara", "Evan", "Faye", "Gray", "Hope",
  ];
  const paymentMethods = ["SEPAY_QR", "PAYPAL", "STRIPE", "BANK_TRANSFER"];
  const statusForIndex = (index: number) => {
    if (index <= 20) return "PENDING";
    if (index <= 30) return "CONFIRMED";
    if (index <= 40) return "PROCESSING";
    if (index <= 55) return "COMPLETED";
    return "FAILED";
  };

  const demoOrders = names.map((name, index) => {
    const orderIndex = index + 1;
    const status = statusForIndex(orderIndex);
    return makeOrder(
      orderIndex,
      `${name} ${status}`,
      status,
      paymentMethods[index % paymentMethods.length],
      350000 + orderIndex * 45000,
    );
  });

  for (const order of demoOrders) {
    await prisma.order.create({
      data: {
        ...order,
        items: order.items as object[],
        shippingAddress: order.shippingAddress as object,
      },
    });
  }

  console.log(`[${config.serviceName}] Ensured ${demoOrders.length} admin demo orders`);
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
  // Connect to PostgreSQL
  await prisma.$connect();
  await ensureOrderAdminData();
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
