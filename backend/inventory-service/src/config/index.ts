export const config = {
  port: parseInt(process.env.PORT || "4003", 10),
  serviceName: "InventoryService",
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:admin@localhost:5432/inventory_db",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
  simulation: {
    processingDelayMs: 1000,
    stockFailureRate: 0.05, // 5% out-of-stock for demo
  },
};
