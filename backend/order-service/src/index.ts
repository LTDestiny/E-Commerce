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

  const count = await prisma.order.count();
  if (count > 0) return;

  const demoOrders = [
    {
      id: "order-ts-9421",
      orderCode: "TS-9421",
      customerId: "user-customer-jordan",
      status: "DELIVERED",
      paymentMethod: "STRIPE",
      totalAmount: 1205800,
      items: [
        { productId: "SKU-7822-X", productName: "Quantum-X 32 inch Curved Display", quantity: 1, unitPrice: 899000 },
        { productId: "SKU-9901-B", productName: "Mechanical Pro-Typist Keyboard", quantity: 1, unitPrice: 159000 },
      ],
      shippingAddress: {
        fullName: "Jordan Smith",
        phone: "+1 415 555 0198",
        street: "1200 Market Street, Suite 450",
        city: "San Francisco",
        state: "CA",
        zipCode: "94102",
        country: "United States",
      },
    },
    {
      id: "order-ts-9420",
      orderCode: "TS-9420",
      customerId: "user-customer-sarah",
      status: "PENDING_PAYMENT",
      paymentMethod: "PAYPAL",
      totalAmount: 499000,
      items: [
        { productId: "PROD-004", productName: "AirPods Pro 2", quantity: 1, unitPrice: 499000 },
      ],
      shippingAddress: {
        fullName: "Sarah Connor",
        phone: "+1 212 555 0101",
        street: "880 Mission Avenue",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "United States",
      },
    },
    {
      id: "order-ts-9419",
      orderCode: "TS-9419",
      customerId: "user-customer-arthur",
      status: "SHIPPED",
      paymentMethod: "BANK_TRANSFER",
      totalAmount: 2840500,
      items: [
        { productId: "SKU-5541-M", productName: "Fiber Optic Switch 48p", quantity: 12, unitPrice: 236708.33 },
      ],
      shippingAddress: {
        fullName: "Arthur Morgan",
        phone: "+1 303 555 0120",
        street: "77 Alpine Road",
        city: "Denver",
        state: "CO",
        zipCode: "80202",
        country: "United States",
      },
    },
    {
      id: "order-ts-9418",
      orderCode: "TS-9418",
      customerId: "user-customer-liam",
      status: "CANCELLED",
      paymentMethod: "SEPAY_QR",
      totalAmount: 120000,
      items: [
        { productId: "SKU-1122", productName: "10m Optic Fiber Cable", quantity: 2, unitPrice: 60000 },
      ],
      shippingAddress: {
        fullName: "Liam Neesson",
        phone: "+1 650 555 0130",
        street: "402 Harbor Lane",
        city: "San Jose",
        state: "CA",
        zipCode: "95113",
        country: "United States",
      },
    },
  ];

  for (const order of demoOrders) {
    await prisma.order.create({
      data: {
        ...order,
        items: order.items as object[],
        shippingAddress: order.shippingAddress as object,
      },
    });
  }

  console.log(`[${config.serviceName}] Seeded ${demoOrders.length} admin demo orders`);
}

async function main() {
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
