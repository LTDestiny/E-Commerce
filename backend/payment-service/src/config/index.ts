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
  sepay: {
    enabled: (process.env.PAYMENT_METHOD || "SEPAY_QR") === "SEPAY_QR",
    providerName: process.env.SEPAY_PROVIDER_NAME || "SePay",
    paymentAccount: process.env.SEPAY_PAYMENT_ACCOUNT || "880123456789",
    bankName: process.env.SEPAY_BANK_NAME || "VietQR Demo Bank",
    qrTemplate: process.env.SEPAY_QR_TEMPLATE || "SEPAY-{orderId}-{amount}",
    webhookSecret:
      process.env.SEPAY_WEBHOOK_SECRET || "dev_sepay_webhook_secret",
    webhookPath:
      process.env.SEPAY_WEBHOOK_PATH || "/api/payments/sepay/webhook",
  },
  paymentExpiration: {
    ttlMs: parseInt(process.env.PAYMENT_EXPIRATION_MS || `${15 * 60 * 1000}`, 10),
    scanIntervalMs: parseInt(
      process.env.PAYMENT_EXPIRATION_SCAN_INTERVAL_MS || `${30 * 1000}`,
      10,
    ),
  },
  paymentMethods: {
    defaultMethod: process.env.PAYMENT_METHOD || "SEPAY_QR",
  },
};
