import express, {
  Request,
  Response as ExpressResponse,
  NextFunction,
} from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import Redis from "ioredis";
import rateLimit from "express-rate-limit";
import { config } from "./config";

const SERVICE_HEALTH_TIMEOUT_MS = 2000;
const SERVICE_HEALTH_RETRY_DELAYS_MS = [3000, 5000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkServiceHealthWithRetry(service: {
  name: string;
  url: string;
}) {
  const healthUrl = `${service.url}/health`;
  let lastError = "Unknown error";

  for (
    let attempt = 0;
    attempt <= SERVICE_HEALTH_RETRY_DELAYS_MS.length;
    attempt++
  ) {
    try {
      const response = await fetchWithTimeout(
        healthUrl,
        SERVICE_HEALTH_TIMEOUT_MS,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json().catch(() => null);

      return {
        ...service,
        status: "healthy",
        attempts: attempt + 1,
        data,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";

      if (attempt < SERVICE_HEALTH_RETRY_DELAYS_MS.length) {
        const retryDelay = SERVICE_HEALTH_RETRY_DELAYS_MS[attempt];

        console.log(
          `[APIGateway] ${service.name} health check failed on attempt ${
            attempt + 1
          }. Retrying in ${retryDelay / 1000}s...`,
        );

        await delay(retryDelay);
      }
    }
  }

  return {
    ...service,
    status: "unhealthy",
    attempts: SERVICE_HEALTH_RETRY_DELAYS_MS.length + 1,
    error: lastError,
  };
}

async function main() {
  const app = express();

  app.use(cors({ origin: config.cors.origin, credentials: true }));

  // ==========================================
  // Server-side Rate Limiter at API Gateway
  // ==========================================
  const generalApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests. Please wait and try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    },
  });

  const createOrderLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error:
        "Too many order creation requests. Please wait before placing another order.",
      code: "ORDER_RATE_LIMIT_EXCEEDED",
    },
  });

  app.use((req: Request, res: ExpressResponse, next: NextFunction) => {
    if (req.path === "/api/health" || req.path === "/api/events/stream") {
      return next();
    }

    return generalApiLimiter(req, res, next);
  });

  app.use(
    "/api/orders",
    (req: Request, res: ExpressResponse, next: NextFunction) => {
      if (req.method !== "POST") {
        return next();
      }

      return createOrderLimiter(req, res, next);
    },
  );

  const proxyOptions = { changeOrigin: true };

  app.use(
    createProxyMiddleware({
      target: config.services.auth,
      pathFilter: "/api/auth",
      ...proxyOptions,
    }),
  );

  app.use(
    createProxyMiddleware({
      target: config.services.order,
      pathFilter: "/api/orders",
      ...proxyOptions,
    }),
  );

  app.use(
    createProxyMiddleware({
      target: config.services.payment,
      pathFilter: "/api/payments",
      ...proxyOptions,
    }),
  );

  app.use(
    createProxyMiddleware({
      target: config.services.inventory,
      pathFilter: "/api/inventory",
      ...proxyOptions,
    }),
  );

  app.use(
    createProxyMiddleware({
      target: config.services.shipping,
      pathFilter: "/api/shipments",
      ...proxyOptions,
    }),
  );

  app.use(
    createProxyMiddleware({
      target: config.services.notification,
      pathFilter: "/api/notifications",
      ...proxyOptions,
    }),
  );

  const sseClients: Set<ExpressResponse> = new Set();

  app.get("/api/events/stream", (req: Request, res: ExpressResponse) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": config.cors.origin,
    });

    res.write('data: {"type":"CONNECTED","message":"SSE connected"}\n\n');
    sseClients.add(res);

    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  const subscriber = new Redis(config.redis.url);

  const channels = [
    "orders.events",
    "payments.events",
    "inventory.events",
    "shipping.events",
    "notifications.events",
  ];

  for (const channel of channels) {
    await subscriber.subscribe(channel);
  }

  subscriber.on("message", (channel, message) => {
    try {
      const event = JSON.parse(message);
      const sseData = JSON.stringify({ channel, ...event });

      sseClients.forEach((client) => {
        client.write(`data: ${sseData}\n\n`);
      });
    } catch {
      // Ignore malformed event messages to avoid breaking the SSE stream.
    }
  });

  app.get("/api/health", async (_req: Request, res: ExpressResponse) => {
    const services = [
      { name: "AuthService", url: config.services.auth },
      { name: "OrderService", url: config.services.order },
      { name: "PaymentService", url: config.services.payment },
      { name: "InventoryService", url: config.services.inventory },
      { name: "ShippingService", url: config.services.shipping },
      { name: "NotificationService", url: config.services.notification },
    ];

    const checks = await Promise.all(
      services.map((svc) => checkServiceHealthWithRetry(svc)),
    );

    const allHealthy = checks.every((svc) => svc.status === "healthy");

    res.status(allHealthy ? 200 : 503).json({
      gateway: config.serviceName,
      status: allHealthy ? "healthy" : "degraded",
      retryPolicy: {
        timeoutMs: SERVICE_HEALTH_TIMEOUT_MS,
        retryDelaysMs: SERVICE_HEALTH_RETRY_DELAYS_MS,
        maxAttempts: SERVICE_HEALTH_RETRY_DELAYS_MS.length + 1,
      },
      services: checks,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/health", (_req: Request, res: ExpressResponse) => {
    res.json({
      service: config.serviceName,
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.listen(config.port, () => {
    console.log(
      `🌐 ${config.serviceName} running on http://localhost:${config.port}`,
    );
    console.log("[APIGateway] Server-side rate limiter enabled");
    console.log(
      "[APIGateway] Health check retry enabled: retry after 3s and 5s on service timeout/failure",
    );
  });

  process.on("SIGTERM", async () => {
    await subscriber.quit();
    process.exit(0);
  });
}

main().catch(console.error);