// ==========================================
// AI Service - Configuration manager
// ==========================================

export const config = {
  port: parseInt(process.env.PORT || "4007", 10),
  serviceName: "AIService",
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
  services: {
    inventory: process.env.INVENTORY_SERVICE_URL || "http://localhost:4003",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
  }
};
