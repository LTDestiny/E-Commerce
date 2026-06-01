// ==========================================
// AI Service - Configuration manager
// ==========================================

function parseCorsOrigins(value?: string) {
  const origins = (value || "http://localhost:3000")
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
  port: parseInt(process.env.PORT || "4007", 10),
  serviceName: "AIService",
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  cors: {
    allowedOrigins: corsOrigins.allowedOrigins,
    primaryOrigin: corsOrigins.primaryOrigin,
  },
  services: {
    inventory: process.env.INVENTORY_SERVICE_URL || "http://localhost:4003",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
  }
};
