// ==========================================
// API Gateway - Entry Point
// - Routes requests to microservices
// - SSE endpoint for real-time event streaming
// - Service health aggregation
// ==========================================

import express, { Request, Response } from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import Redis from "ioredis";
import { config } from "./config";
import { EVENT_CHANNELS } from "@ecommerce/shared";

async function main() {
  const app = express();
  app.use(cors({ origin: config.cors.origin, credentials: true }));
  app.use(express.json());

  // ==========================================
  // Proxy routes to microservices
  // ==========================================
  const proxyOptions = { changeOrigin: true };

  app.use(
    "/api/orders",
    createProxyMiddleware({
      target: config.services.order,
      ...proxyOptions,
    }),
  );

  app.use(
    "/api/payments",
    createProxyMiddleware({
      target: config.services.payment,
      ...proxyOptions,
    }),
  );

  app.use(
    "/api/inventory",
    createProxyMiddleware({
      target: config.services.inventory,
      ...proxyOptions,
    }),
  );

  app.use(
    "/api/shipments",
    createProxyMiddleware({
      target: config.services.shipping,
      ...proxyOptions,
    }),
  );

  app.use(
    "/api/notifications",
    createProxyMiddleware({
      target: config.services.notification,
      ...proxyOptions,
    }),
  );

  // ==========================================
  // SSE - Real-time event streaming to frontend
  // ==========================================
  const sseClients: Set<Response> = new Set();

  app.get("/api/events/stream", (req: Request, res: Response) => {
    // SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": config.cors.origin,
    });

    // Send heartbeat
    res.write('data: {"type":"CONNECTED","message":"SSE connected"}\n\n');

    sseClients.add(res);
    console.log(
      `[${config.serviceName}] SSE client connected (total: ${sseClients.size})`,
    );

    req.on("close", () => {
      sseClients.delete(res);
      console.log(
        `[${config.serviceName}] SSE client disconnected (total: ${sseClients.size})`,
      );
    });
  });

  // Subscribe to all event channels via Redis and broadcast to SSE clients
  const subscriber = new Redis(config.redis.url);
  const allChannels = Object.values(EVENT_CHANNELS);

  for (const channel of allChannels) {
    await subscriber.subscribe(channel);
  }

  subscriber.on("message", (channel: string, message: string) => {
    try {
      const event = JSON.parse(message);
      const sseData = JSON.stringify({ channel, ...event });

      sseClients.forEach((client) => {
        client.write(`data: ${sseData}\n\n`);
      });
    } catch {
      // ignore parse errors
    }
  });

  console.log(
    `[${config.serviceName}] Subscribed to ${allChannels.length} event channels for SSE`,
  );

  // ==========================================
  // Service health aggregation
  // ==========================================
  app.get("/api/health", async (_req: Request, res: Response) => {
    const services = [
      { name: "OrderService", url: config.services.order },
      { name: "PaymentService", url: config.services.payment },
      { name: "InventoryService", url: config.services.inventory },
      { name: "ShippingService", url: config.services.shipping },
      { name: "NotificationService", url: config.services.notification },
    ];

    const healthChecks = await Promise.allSettled(
      services.map(async (svc) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const response = await fetch(`${svc.url}/health`, {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const data = await response.json();
          return { ...svc, status: "healthy", data };
        } catch {
          return { ...svc, status: "unhealthy", data: null };
        }
      }),
    );

    const results = healthChecks.map((result) =>
      result.status === "fulfilled" ? result.value : { status: "unhealthy" },
    );

    const allHealthy = results.every((r) => r.status === "healthy");

    res.json({
      gateway: config.serviceName,
      status: allHealthy ? "healthy" : "degraded",
      sseClients: sseClients.size,
      timestamp: new Date().toISOString(),
      services: results,
    });
  });

  // Gateway health
  app.get("/health", (_req, res) => {
    res.json({
      service: config.serviceName,
      status: "healthy",
      uptime: process.uptime(),
      sseClients: sseClients.size,
      timestamp: new Date().toISOString(),
    });
  });

  // Start server
  app.listen(config.port, () => {
    console.log(
      `🌐 ${config.serviceName} running on http://localhost:${config.port}`,
    );
    console.log(`   → Orders:        ${config.services.order}`);
    console.log(`   → Payments:      ${config.services.payment}`);
    console.log(`   → Inventory:     ${config.services.inventory}`);
    console.log(`   → Shipping:      ${config.services.shipping}`);
    console.log(`   → Notifications: ${config.services.notification}`);
  });

  process.on("SIGTERM", async () => {
    await subscriber.quit();
    process.exit(0);
  });
}

main().catch(console.error);
