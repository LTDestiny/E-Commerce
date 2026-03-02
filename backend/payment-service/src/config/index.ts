export const config = {
  port: parseInt(process.env.PORT || "4002", 10),
  serviceName: "PaymentService",
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:admin@localhost:5432/payment_db",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
  // Simulate payment gateway
  simulation: {
    processingDelayMs: 2000,
    failureRate: 0.1, // 10% chance of failure for demo
  },
};
