-- ==========================================
-- PostgreSQL Init Script
-- Creates 6 databases + all tables
-- (Database-per-Service pattern)
-- ==========================================

-- ===== Create Databases =====
CREATE DATABASE order_db;
CREATE DATABASE payment_db;
CREATE DATABASE inventory_db;
CREATE DATABASE shipping_db;
CREATE DATABASE notification_db;
CREATE DATABASE ecommerce_auth;

GRANT ALL PRIVILEGES ON DATABASE order_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE payment_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE inventory_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE shipping_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE notification_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE ecommerce_auth TO postgres;

-- ==========================================
-- ORDER DB - Tables
-- ==========================================
\c order_db

CREATE TABLE "orders" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "orderCode" TEXT NOT NULL DEFAULT '',
    "customerId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "shippingAddress" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL DEFAULT 'SEPAY_QR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "events_correlationId_idx" ON "events"("correlationId");
CREATE INDEX "events_type_idx" ON "events"("type");

-- ==========================================
-- PAYMENT DB - Tables
-- ==========================================
\c payment_db

CREATE TABLE "payments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "method" TEXT NOT NULL DEFAULT 'CREDIT_CARD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'SEPAY',
    "qrCode" TEXT,
    "transferContent" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "events_correlationId_idx" ON "events"("correlationId");
CREATE INDEX "events_type_idx" ON "events"("type");

-- ==========================================
-- INVENTORY DB - Tables
-- ==========================================
\c inventory_db

CREATE TABLE "inventory_items" (
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "totalStock" INTEGER NOT NULL,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "availableStock" INTEGER NOT NULL,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("productId")
);

CREATE TABLE "stock_reservations" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "orderId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_reservations_orderId_idx" ON "stock_reservations"("orderId");

CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "events_correlationId_idx" ON "events"("correlationId");
CREATE INDEX "events_type_idx" ON "events"("type");

-- ==========================================
-- SHIPPING DB - Tables
-- ==========================================
\c shipping_db

CREATE TABLE "shipments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "orderId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "estimatedDelivery" TIMESTAMP(3),
    "actualDelivery" TIMESTAMP(3),
    "shippingAddress" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "shipments_orderId_idx" ON "shipments"("orderId");

CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "events_correlationId_idx" ON "events"("correlationId");
CREATE INDEX "events_type_idx" ON "events"("type");

-- ==========================================
-- NOTIFICATION DB - Tables
-- ==========================================
\c notification_db

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_orderId_idx" ON "notifications"("orderId");

CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "events_correlationId_idx" ON "events"("correlationId");
CREATE INDEX "events_type_idx" ON "events"("type");

-- ==========================================
-- AUTH DB - Tables
-- ==========================================
\c ecommerce_auth

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "refreshTokenHash" TEXT,
    "refreshTokenJti" TEXT,
    "refreshTokenExp" TIMESTAMP(3),
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_refreshTokenJti_key" ON "users"("refreshTokenJti");
CREATE UNIQUE INDEX "users_resetPasswordToken_key" ON "users"("resetPasswordToken");

INSERT INTO "users" ("id", "name", "email", "passwordHash", "role", "createdAt", "updatedAt") 
VALUES ('usr-admin-1', 'Admin User', 'admin@gmail.com', '$2b$10$zddqgz5Gtg6Hrw1sQsFt5.YkD8ltHAatJe6SiaWj8VhhYF5fDfRGm', 'ADMIN', NOW(), NOW());
INSERT INTO "users" ("id", "name", "email", "passwordHash", "role", "createdAt", "updatedAt") 
VALUES ('usr-user-1', 'Test User', 'user@gmail.com', '$2b$10$OMVywDy0mQuqY4qTgt8A1.p8mLnrXXgmOfiX4afeJSy36OTO3hQmi', 'USER', NOW(), NOW());
