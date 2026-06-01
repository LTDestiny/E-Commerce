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
  port: parseInt(process.env.PORT || "4006", 10),
  serviceName: "AuthService",
  cors: {
    allowedOrigins: corsOrigins.allowedOrigins,
    primaryOrigin: corsOrigins.primaryOrigin,
  },
  cookie: {
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: (process.env.COOKIE_SAMESITE || "lax") as "lax" | "strict" | "none",
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret_change_me",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
};

