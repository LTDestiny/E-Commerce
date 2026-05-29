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
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL || "http://localhost:4006",
    order: process.env.ORDER_SERVICE_URL || "http://localhost:4001",
    payment: process.env.PAYMENT_SERVICE_URL || "http://localhost:4002",
    inventory: process.env.INVENTORY_SERVICE_URL || "http://localhost:4003",
    shipping: process.env.SHIPPING_SERVICE_URL || "http://localhost:4004",
    notification:
      process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4005",
  },
};
