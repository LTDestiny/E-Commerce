function parseCorsOrigins(value?: string) {
  const origins = (value || "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    allowedOrigins: origins,
    primaryOrigin: origins[0] || "http://localhost:3000",
  };
}

const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  serviceName: "APIGateway",
  jwt: {
    secret: process.env.JWT_SECRET || "dev_jwt_secret_change_me",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  gateway: {
    proxyTimeoutMs: parseInt(process.env.PROXY_TIMEOUT_MS || "5000", 10),
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || "10000", 10),
    circuitFailureThreshold: parseInt(
      process.env.CIRCUIT_FAILURE_THRESHOLD || "3",
      10,
    ),
    circuitOpenMs: parseInt(process.env.CIRCUIT_OPEN_MS || "15000", 10),
    healthTimeoutMs: parseInt(process.env.HEALTH_TIMEOUT_MS || "2000", 10),
    healthRetryDelaysMs: (process.env.HEALTH_RETRY_DELAYS_MS || "3000,5000")
      .split(",")
      .map((value) => parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value) && value >= 0),
    rateLimit: {
      generalWindowMs: parseInt(
        process.env.RATE_LIMIT_WINDOW_MS || "60000",
        10,
      ),
      generalMax: parseInt(process.env.RATE_LIMIT_MAX || "120", 10),
      authWindowMs: parseInt(
        process.env.AUTH_RATE_LIMIT_WINDOW_MS || "900000",
        10,
      ),
      authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || "20", 10),
      createOrderWindowMs: parseInt(
        process.env.ORDER_RATE_LIMIT_WINDOW_MS || "60000",
        10,
      ),
      createOrderMax: parseInt(
        process.env.ORDER_RATE_LIMIT_MAX || "10",
        10,
      ),
      paymentWindowMs: parseInt(
        process.env.PAYMENT_RATE_LIMIT_WINDOW_MS || "60000",
        10,
      ),
      paymentMax: parseInt(process.env.PAYMENT_RATE_LIMIT_MAX || "30", 10),
      aiWindowMs: parseInt(
        process.env.AI_RATE_LIMIT_WINDOW_MS || "60000",
        10,
      ),
      aiMax: parseInt(process.env.AI_RATE_LIMIT_MAX || "20", 10),
    },
  },
  cors: {
    allowedOrigins: corsOrigins.allowedOrigins,
    primaryOrigin: corsOrigins.primaryOrigin,
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL || "http://localhost:4006",
    order: process.env.ORDER_SERVICE_URL || "http://localhost:4001",
    payment: process.env.PAYMENT_SERVICE_URL || "http://localhost:4002",
    inventory: process.env.INVENTORY_SERVICE_URL || "http://localhost:4003",
    shipping: process.env.SHIPPING_SERVICE_URL || "http://localhost:4004",
    notification:
      process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4005",
    ai: process.env.AI_SERVICE_URL || "http://localhost:4007",
  },
};
