export const config = {
  port: parseInt(process.env.PORT || "4006", 10),
  serviceName: "AuthService",
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
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
};
