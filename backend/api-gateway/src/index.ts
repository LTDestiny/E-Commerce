import express, {
  Request,
  Response as ExpressResponse,
  NextFunction,
} from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import Redis from "ioredis";
import rateLimit from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import jwt from "jsonwebtoken";
import { config } from "./config";

const SERVICE_HEALTH_TIMEOUT_MS = config.gateway.healthTimeoutMs;
const SERVICE_HEALTH_RETRY_DELAYS_MS = config.gateway.healthRetryDelaysMs;

type ServiceState = {
  failures: number;
  openedUntil: number;
  lastError?: string;
};

const serviceStates = new Map<string, ServiceState>();

function getServiceState(serviceName: string): ServiceState {
  const current = serviceStates.get(serviceName);
  if (current) return current;

  const next = { failures: 0, openedUntil: 0 };
  serviceStates.set(serviceName, next);
  return next;
}

function recordServiceSuccess(serviceName: string) {
  const state = getServiceState(serviceName);
  state.failures = 0;
  state.openedUntil = 0;
  state.lastError = undefined;
}

function recordServiceFailure(serviceName: string, error: unknown) {
  const state = getServiceState(serviceName);
  state.failures += 1;
  state.lastError = error instanceof Error ? error.message : String(error);

  if (state.failures >= config.gateway.circuitFailureThreshold) {
    state.openedUntil = Date.now() + config.gateway.circuitOpenMs;
    console.warn(
      `[APIGateway] Circuit opened for ${serviceName} after ${state.failures} failures`,
    );
  }
}

function createCircuitGuard(serviceName: string, pathFilter: string) {
  return (req: Request, res: ExpressResponse, next: NextFunction) => {
    if (!req.path.startsWith(pathFilter)) {
      next();
      return;
    }

    const state = getServiceState(serviceName);
    const retryAfterMs = state.openedUntil - Date.now();

    if (retryAfterMs > 0) {
      res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
      res.status(503).json({
        error: `${serviceName} is temporarily unavailable`,
        code: "SERVICE_CIRCUIT_OPEN",
        service: serviceName,
        retryAfterMs,
      });
      return;
    }

    next();
  };
}

function sendProxyError(
  serviceName: string,
  err: Error,
  res: ExpressResponse,
) {
  if (res.headersSent) return;

  const status = err.message?.includes("timeout") ? 504 : 503;
  res.status(status).json({
    error: `${serviceName} is unavailable`,
    code: status === 504 ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
    service: serviceName,
    detail: err.message,
  });
}

function createStableProxy(service: {
  name: string;
  pathFilter: string;
  target: string;
}) {
  return [
    createCircuitGuard(service.name, service.pathFilter),
    createProxyMiddleware<Request, ExpressResponse>({
      target: service.target,
      pathFilter: service.pathFilter,
      changeOrigin: true,
      proxyTimeout: config.gateway.proxyTimeoutMs,
      timeout: config.gateway.requestTimeoutMs,
      on: {
        proxyRes: (proxyRes) => {
          if (proxyRes.statusCode && proxyRes.statusCode >= 500) {
            recordServiceFailure(
              service.name,
              new Error(`HTTP ${proxyRes.statusCode}`),
            );
            return;
          }

          recordServiceSuccess(service.name);
        },
        error: (err, _req, res) => {
          recordServiceFailure(service.name, err);
          sendProxyError(service.name, err, res as ExpressResponse);
        },
      },
    }),
  ] as const;
}

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
  const redisOptions = {
    maxRetriesPerRequest: 2,
    reconnectOnError: () => true,
    retryStrategy: (times: number) => Math.min(times * 100, 2000),
  };
  const rateLimitRedis = new Redis(config.redis.url, redisOptions);
  const createRedisStore = (prefix: string) =>
    new RedisStore({
      prefix,
      sendCommand: (...args: string[]) =>
        (rateLimitRedis.call as (...command: string[]) => Promise<RedisReply>)(
          ...args,
        ),
    });

  app.use(cors({ origin: config.cors.origin, credentials: true }));

  // ==========================================
  // Server-side Rate Limiter at API Gateway
  // ==========================================
  const generalApiLimiter = rateLimit({
    store: createRedisStore("rl:gateway:general:"),
    windowMs: config.gateway.rateLimit.generalWindowMs,
    max: config.gateway.rateLimit.generalMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests. Please wait and try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    },
  });

  const createOrderLimiter = rateLimit({
    store: createRedisStore("rl:gateway:create-order:"),
    windowMs: config.gateway.rateLimit.createOrderWindowMs,
    max: config.gateway.rateLimit.createOrderMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error:
        "Too many order creation requests. Please wait before placing another order.",
      code: "ORDER_RATE_LIMIT_EXCEEDED",
    },
  });

  const sensitiveAuthLimiter = rateLimit({
    store: createRedisStore("rl:gateway:auth:"),
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many authentication requests. Please try again later.",
      code: "AUTH_RATE_LIMIT_EXCEEDED",
    },
  });

  const paymentLimiter = rateLimit({
    store: createRedisStore("rl:gateway:payment:"),
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many payment requests. Please slow down.",
      code: "PAYMENT_RATE_LIMIT_EXCEEDED",
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

  app.use(
    "/api/auth",
    (req: Request, res: ExpressResponse, next: NextFunction) =>
      sensitiveAuthLimiter(req, res, next),
  );

  app.use(
    "/api/payments",
    (req: Request, res: ExpressResponse, next: NextFunction) => {
      if (req.method === "GET") {
        return next();
      }

      return paymentLimiter(req, res, next);
    },
  );

  function gatewayAuthMiddleware(req: Request, res: ExpressResponse, next: NextFunction) {
    const publicPaths = [
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/refresh",
      "/api/auth/forgot-password",
      "/api/auth/reset-password",
      "/api/health",
      "/health",
      "/api/events/stream"
    ];

    if (
      publicPaths.includes(req.path) ||
      req.path.startsWith("/api/inventory") ||
      req.path.startsWith("/api/events")
    ) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing authorization token", code: "UNAUTHORIZED" });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const secret = process.env.JWT_ACCESS_SECRET || "change_me_access_secret";
      const decoded = jwt.verify(token, secret) as any;

      req.headers["x-user-id"] = decoded.id;
      req.headers["x-user-email"] = decoded.email;
      req.headers["x-user-role"] = decoded.role;
      req.headers["x-user-name"] = encodeURIComponent(decoded.name || "");

      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid or expired token", code: "INVALID_TOKEN" });
      return;
    }
  }

  app.use(gatewayAuthMiddleware);

  app.use(...createStableProxy({
    name: "AuthService",
    pathFilter: "/api/auth",
    target: config.services.auth,
  }));

  app.use(...createStableProxy({
    name: "AuthServiceUsers",
    pathFilter: "/api/users",
    target: config.services.auth,
  }));

  app.use(...createStableProxy({
    name: "OrderService",
    pathFilter: "/api/orders",
    target: config.services.order,
  }));

  app.use(...createStableProxy({
    name: "PaymentService",
    pathFilter: "/api/payments",
    target: config.services.payment,
  }));

  app.use(...createStableProxy({
    name: "InventoryService",
    pathFilter: "/api/inventory",
    target: config.services.inventory,
  }));

  app.use(...createStableProxy({
    name: "ShippingService",
    pathFilter: "/api/shipments",
    target: config.services.shipping,
  }));

  app.use(...createStableProxy({
    name: "NotificationService",
    pathFilter: "/api/notifications",
    target: config.services.notification,
  }));

  const sseClients: Set<ExpressResponse> = new Set();

  app.get("/api/events/stream", (req: Request, res: ExpressResponse) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": config.cors.origin,
    });
    res.write(": heartbeat\n\n");

    res.write('data: {"type":"CONNECTED","message":"SSE connected"}\n\n');
    sseClients.add(res);

    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  const subscriber = new Redis(config.redis.url, redisOptions);

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
      circuitBreakers: Object.fromEntries(serviceStates),
      services: checks,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/health", (_req: Request, res: ExpressResponse) => {
    res.json({
      service: config.serviceName,
      status: "healthy",
      uptime: process.uptime(),
      rateLimit: config.gateway.rateLimit,
      proxy: {
        timeoutMs: config.gateway.proxyTimeoutMs,
        requestTimeoutMs: config.gateway.requestTimeoutMs,
        circuitFailureThreshold: config.gateway.circuitFailureThreshold,
        circuitOpenMs: config.gateway.circuitOpenMs,
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.use(
    (
      err: Error,
      _req: Request,
      res: ExpressResponse,
      _next: NextFunction,
    ) => {
      console.error("[APIGateway] Unhandled request error:", err);
      if (res.headersSent) return;

      res.status(500).json({
        error: "API Gateway internal error",
        code: "GATEWAY_INTERNAL_ERROR",
      });
    },
  );

  app.listen(config.port, () => {
    console.log(
      `🌐 ${config.serviceName} running on http://localhost:${config.port}`,
    );
    console.log("[APIGateway] Server-side rate limiter enabled");
    console.log(
      `[APIGateway] Rate limit: ${config.gateway.rateLimit.generalMax}/${config.gateway.rateLimit.generalWindowMs}ms general, ${config.gateway.rateLimit.createOrderMax}/${config.gateway.rateLimit.createOrderWindowMs}ms order creation`,
    );
    console.log(
      `[APIGateway] Health retry delays: ${SERVICE_HEALTH_RETRY_DELAYS_MS.join(", ")}ms`,
    );
  });

  process.on("SIGTERM", async () => {
    await Promise.all([subscriber.quit(), rateLimitRedis.quit()]);
    process.exit(0);
  });
}

main().catch(console.error);
