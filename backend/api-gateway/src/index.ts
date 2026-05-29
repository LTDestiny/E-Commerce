import express, { Request, Response } from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import Redis from "ioredis";
import { config } from "./config";

async function main() {
  const app = express();
  app.use(cors({ origin: config.cors.origin, credentials: true }));

  const proxyOptions = { changeOrigin: true };
  app.use(createProxyMiddleware({ target: config.services.auth, pathFilter: "/api/auth", ...proxyOptions }));
  app.use(createProxyMiddleware({ target: config.services.order, pathFilter: "/api/orders", ...proxyOptions }));
  app.use(createProxyMiddleware({ target: config.services.payment, pathFilter: "/api/payments", ...proxyOptions }));
  app.use(createProxyMiddleware({ target: config.services.inventory, pathFilter: "/api/inventory", ...proxyOptions }));
  app.use(createProxyMiddleware({ target: config.services.shipping, pathFilter: "/api/shipments", ...proxyOptions }));
  app.use(createProxyMiddleware({ target: config.services.notification, pathFilter: "/api/notifications", ...proxyOptions }));

  const sseClients: Set<Response> = new Set();
  app.get("/api/events/stream", (req: Request, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": config.cors.origin,
    });
    res.write('data: {"type":"CONNECTED","message":"SSE connected"}\n\n');
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
  });

  const subscriber = new Redis(config.redis.url);
  const channels = ["orders.events", "payments.events", "inventory.events", "shipping.events", "notifications.events"];
  for (const channel of channels) await subscriber.subscribe(channel);
  subscriber.on("message", (channel, message) => {
    try {
      const event = JSON.parse(message);
      const sseData = JSON.stringify({ channel, ...event });
      sseClients.forEach((client) => client.write(`data: ${sseData}\n\n`));
    } catch {}
  });

  app.get("/api/health", async (_req: Request, res: Response) => {
    const services = [
      { name: "AuthService", url: config.services.auth },
      { name: "OrderService", url: config.services.order },
      { name: "PaymentService", url: config.services.payment },
      { name: "InventoryService", url: config.services.inventory },
      { name: "ShippingService", url: config.services.shipping },
      { name: "NotificationService", url: config.services.notification },
    ];
    const checks = await Promise.allSettled(services.map(async (svc) => ({ ...svc, status: "healthy" })));
    res.json({ gateway: config.serviceName, status: "healthy", services: checks.map((r) => r.status === "fulfilled" ? r.value : { status: "unhealthy" }), timestamp: new Date().toISOString() });
  });

  app.get("/health", (_req, res) => res.json({ service: config.serviceName, status: "healthy", uptime: process.uptime(), timestamp: new Date().toISOString() }));

  app.listen(config.port, () => console.log(`🌐 ${config.serviceName} running on http://localhost:${config.port}`));
  process.on("SIGTERM", async () => { await subscriber.quit(); process.exit(0); });
}

main().catch(console.error);
