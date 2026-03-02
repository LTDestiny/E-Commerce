export const config = {
  port: parseInt(process.env.PORT || "4004", 10),
  serviceName: "ShippingService",
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:admin@localhost:5432/shipping_db",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
  simulation: {
    schedulingDelayMs: 1500,
  },
};
