// ==========================================
// Order Service Configuration
// ==========================================

export const config = {
  port: parseInt(process.env.PORT || "4001", 10),
  serviceName: "OrderService",
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:admin@localhost:5432/order_db",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
};
