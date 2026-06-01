// ==========================================
// Shipping Service - Entry Point
// ==========================================

import express from "express";
import cors from "cors";
import { RedisEventBus, KafkaEventBus } from "@ecommerce/shared";
import { config } from "./config";
import { createShippingRoutes } from "./routes/shipping.routes";
import { registerEventHandlers } from "./handlers/shipping.handler";
import { prisma } from "./lib/prisma";
import { PrismaEventStore } from "./lib/event-store";

async function ensureShippingAdminData() {
  await prisma.shipment.deleteMany({
    where: {
      OR: [
        { id: { startsWith: "ship-ts-" } },
        { orderId: { startsWith: "order-ts-" } },
      ],
    },
  });

  const address = (index: number, fullName: string) => ({
    fullName,
    phone: `+84 90 555 ${9600 + index}`,
    street: `${index} Flow State Avenue`,
    city: "Ho Chi Minh City",
    state: "HCMC",
    zipCode: "700000",
    country: "Vietnam",
  });

  const carriers = ["GIAO_HANG_NHANH", "VIETTEL_POST", "J_AND_T", "SHOPEE_EXPRESS", "GIAO_HANG_TIET_KIEM"];
  const shipmentStatusForIndex = (index: number) => {
    if (index <= 30) return "PENDING";
    if (index <= 35) return "READY";
    if (index <= 40) return "DELAYED";
    if (index <= 55) return "DELIVERED";
    return "FAILED";
  };
  const demoShipments = Array.from({ length: 60 }, (_, index) => {
    const orderIndex = index + 1;
    const status = shipmentStatusForIndex(orderIndex);
    return {
      id: `ship-ts-${9600 + orderIndex}`,
      orderId: `order-ts-${9600 + orderIndex}`,
      status,
      carrier: carriers[index % carriers.length],
      trackingNumber: ["READY", "IN_TRANSIT", "DELAYED", "DELIVERED"].includes(status) ? `TRK-TS-${9600 + orderIndex}` : null,
      shippingAddress: address(orderIndex, `Customer ${String(orderIndex).padStart(2, "0")} ${status}`),
    };
  });

  for (const shipment of demoShipments) {
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);
    await prisma.shipment.create({
      data: {
        ...shipment,
        estimatedDelivery,
        actualDelivery: shipment.status === "DELIVERED" ? new Date() : undefined,
        shippingAddress: shipment.shippingAddress as object,
      },
    });
  }

  console.log(`[${config.serviceName}] Ensured ${demoShipments.length} admin demo shipments`);
}

async function main() {
  await prisma.$connect();
  await ensureShippingAdminData();
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

  app.use("/api/shipments", createShippingRoutes(eventBus, eventStore));

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
      `🚚 ${config.serviceName} running on http://localhost:${config.port}`,
    );
  });

  process.on("SIGTERM", async () => {
    await eventBus.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
