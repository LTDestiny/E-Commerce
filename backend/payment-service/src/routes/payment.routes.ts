// ==========================================
// Payment Service Routes
// ==========================================

import { Router, Request, Response } from "express";
import crypto from "crypto";
import {
  IEventBus,
  IEventStore,
  EVENT_CHANNELS,
  createEvent,
  PaymentProcessedEvent,
  PaymentFailedEvent,
  PaymentStatus,
} from "@ecommerce/shared";
import { paymentRepository } from "../models/payment.repository";
import { config } from "../config";

function serviceHeaders(clientHeaders?: any): Record<string, string> {
  const headers: Record<string, string> = {};
  if (clientHeaders) {
    if (clientHeaders["x-user-id"]) headers["x-user-id"] = String(clientHeaders["x-user-id"]);
    if (clientHeaders["x-user-email"]) headers["x-user-email"] = String(clientHeaders["x-user-email"]);
    if (clientHeaders["x-user-role"]) headers["x-user-role"] = String(clientHeaders["x-user-role"]);
    if (clientHeaders["x-user-name"]) headers["x-user-name"] = String(clientHeaders["x-user-name"]);
  }

  if (!headers["x-user-id"]) {
    headers["x-user-id"] = "payment-service";
    headers["x-user-email"] = "payment-service@internal.local";
    headers["x-user-role"] = "ADMIN";
    headers["x-user-name"] = encodeURIComponent("Payment Service");
  }

  return headers;
}

async function fetchOrder(orderId: string, clientHeaders?: any): Promise<any> {
  const urls = [
    `http://ecommerce-order-service:4001/api/orders/${orderId}`,
    `http://order-service:4001/api/orders/${orderId}`,
    `http://localhost:4001/api/orders/${orderId}`
  ];

  const headers = serviceHeaders(clientHeaders);

  for (const url of urls) {
    try {
      console.log(`[PaymentService fetchOrder] Fetching URL: ${url} (has x-user-id: ${!!headers["x-user-id"]})`);
      const res = await fetch(url, { headers });
      console.log(`[PaymentService fetchOrder] Response status from order-service: ${res.status}`);
      if (res.ok) {
        return await res.json();
      } else {
        const text = await res.text();
        console.log(`[PaymentService fetchOrder] Error body: ${text}`);
      }
    } catch (e) {
      console.error(`[PaymentService fetchOrder] Connection error for ${url}:`, e);
    }
  }
  return null;
}

async function patchOrderStatus(orderId: string, status: string, reason: string, clientHeaders?: any): Promise<any> {
  const urls = [
    `http://ecommerce-order-service:4001/api/orders/${orderId}/status`,
    `http://order-service:4001/api/orders/${orderId}/status`,
    `http://localhost:4001/api/orders/${orderId}/status`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          ...serviceHeaders(clientHeaders),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, reason }),
      });
      if (res.ok) return await res.json();
      console.warn(`[PaymentService sync] Order ${orderId} -> ${status} failed at ${url}: ${res.status} ${await res.text()}`);
    } catch (error) {
      console.warn(`[PaymentService sync] Order status connection failed at ${url}:`, error);
    }
  }

  return null;
}

async function fetchShipmentByOrder(orderId: string): Promise<any> {
  const urls = [
    `http://ecommerce-shipping-service:4004/api/shipments/order/${orderId}`,
    `http://shipping-service:4004/api/shipments/order/${orderId}`,
    `http://localhost:4004/api/shipments/order/${orderId}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status !== 404) {
        console.warn(`[PaymentService sync] Shipment lookup ${orderId} failed at ${url}: ${res.status} ${await res.text()}`);
      }
    } catch (error) {
      console.warn(`[PaymentService sync] Shipment lookup connection failed at ${url}:`, error);
    }
  }

  return null;
}

async function patchShipmentStatus(shipmentId: string, status: string, reason: string, clientHeaders?: any): Promise<any> {
  const urls = [
    `http://ecommerce-shipping-service:4004/api/shipments/${shipmentId}/status`,
    `http://shipping-service:4004/api/shipments/${shipmentId}/status`,
    `http://localhost:4004/api/shipments/${shipmentId}/status`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          ...serviceHeaders(clientHeaders),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, reason }),
      });
      if (res.ok) return await res.json();
      console.warn(`[PaymentService sync] Shipment ${shipmentId} -> ${status} failed at ${url}: ${res.status} ${await res.text()}`);
    } catch (error) {
      console.warn(`[PaymentService sync] Shipment status connection failed at ${url}:`, error);
    }
  }

  return null;
}

async function syncOperationalStatusAfterPayment(payment: any, status: string, reason: string, clientHeaders?: any) {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED") {
    await patchOrderStatus(payment.orderId, "CONFIRMED", reason || "Payment captured by admin", clientHeaders);
    const shipment = await fetchShipmentByOrder(payment.orderId);
    if (shipment && String(shipment.status || "").toUpperCase() === "PENDING") {
      await patchShipmentStatus(shipment.id, "READY", "Payment completed, shipment released for processing", clientHeaders);
    }
    return;
  }

  const orderStatusByPaymentStatus: Record<string, string> = {
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    REFUNDED: "CANCELLED",
  };
  const targetOrderStatus = orderStatusByPaymentStatus[normalized];
  if (!targetOrderStatus) return;

  await patchOrderStatus(payment.orderId, targetOrderStatus, reason || `Payment ${normalized.toLowerCase()}`, clientHeaders);

  const shipment = await fetchShipmentByOrder(payment.orderId);
  const shipmentStatus = String(shipment?.status || "").toUpperCase();
  if (shipment && ["PENDING", "READY"].includes(shipmentStatus) && normalized !== "REFUNDED") {
    await patchShipmentStatus(shipment.id, normalized === "CANCELLED" ? "CANCELLED" : "FAILED", reason || `Payment ${normalized.toLowerCase()}`, clientHeaders);
  }
}

export function createPaymentRoutes(
  eventBus: IEventBus,
  eventStore: IEventStore,
): Router {
  const router = Router();
  const transitions: Record<string, string[]> = {
    PENDING: ["COMPLETED", "FAILED", "CANCELLED"],
    FAILED: ["PENDING", "CANCELLED"],
    COMPLETED: ["REFUNDED"],
    REFUNDED: [],
    CANCELLED: [],
  };

  // GET /api/payments - List all payments
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const payments = await paymentRepository.findAll();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/payments/order/:orderId - Get payment by order
  router.get("/order/:orderId", async (req: Request, res: Response) => {
    try {
      const payment = await paymentRepository.findByOrderId(req.params.orderId);
      if (!payment) {
        res.status(404).json({ error: "Payment not found for this order" });
        return;
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/payments/:id - Get payment by ID
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const payment = await paymentRepository.findById(req.params.id);
      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/payments/:id/status - Admin status control
  router.patch("/:id/status", async (req: Request, res: Response) => {
    try {
      if (String(req.headers["x-user-role"] || "") !== "ADMIN") {
        res.status(403).json({ error: "Admin role is required" });
        return;
      }

      const payment = await paymentRepository.findById(req.params.id);
      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      const requestedStatus = String(req.body?.status || "").toUpperCase();
      const reason = String(req.body?.reason || "").trim();
      if (!Object.values(PaymentStatus).includes(requestedStatus as PaymentStatus)) {
        res.status(400).json({ error: "Invalid payment status" });
        return;
      }

      const currentStatus = String(payment.status || "PENDING").toUpperCase();
      if (currentStatus === requestedStatus) {
        await syncOperationalStatusAfterPayment(
          payment,
          requestedStatus,
          reason || `Payment ${requestedStatus.toLowerCase()} resync via admin status control`,
          req.headers,
        );
        res.json(payment);
        return;
      }

      if (!(transitions[currentStatus] || []).includes(requestedStatus)) {
        res.status(409).json({ error: `Transition ${currentStatus} -> ${requestedStatus} is not allowed` });
        return;
      }

      if (["FAILED", "CANCELLED", "REFUNDED"].includes(requestedStatus) && !reason) {
        res.status(400).json({ error: "Reason is required for sensitive payment status changes" });
        return;
      }

      const transactionId =
        req.body?.transactionId ||
        payment.transactionId ||
        (requestedStatus === "COMPLETED" ? `ADMIN-${crypto.randomBytes(5).toString("hex").toUpperCase()}` : undefined);

      const updated = await paymentRepository.updateStatus(
        payment.id,
        requestedStatus as PaymentStatus,
        transactionId,
        requestedStatus === "COMPLETED" ? new Date() : undefined,
      );
      if (updated) {
        await syncOperationalStatusAfterPayment(
          updated,
          requestedStatus,
          reason || `Payment ${requestedStatus.toLowerCase()} via admin status control`,
          req.headers,
        );
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/sepay/intent", async (req: Request, res: Response) => {
    try {
      const { orderId, customerId, amount, bankName, account } = req.body || {};

      if (!orderId || !customerId || !amount) {
        res.status(400).json({ error: "Missing orderId/customerId/amount" });
        return;
      }

      const activeBankName = bankName || config.sepay.bankName;
      const activeAccount = account || config.sepay.paymentAccount;
      const transferContent = `SEPAY ${String(orderId).slice(0, 8)}`;
      const qrCode = `https://img.vietqr.io/image/${activeBankName}-${activeAccount}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}`;
      const expiredAt = new Date(Date.now() + 15 * 60 * 1000);

      const payment = await paymentRepository.createSepay(
        String(orderId),
        String(customerId),
        Number(amount),
        qrCode,
        transferContent,
        expiredAt
      );

      const qrPayload = {
        provider: config.sepay.providerName,
        bankName: activeBankName,
        account: activeAccount,
        orderId: payment.orderId,
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        template: config.sepay.qrTemplate,
        transferContent,
      };

      res.json({
        ok: true,
        payment,
        qrPayload,
        webhookUrl: config.sepay.webhookPath,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  router.post("/sepay/create", async (req: Request, res: Response) => {
    try {
      const { orderId } = req.body || {};
      const customerId = String(req.headers["x-user-id"] || "");

      if (!orderId) {
        res.status(400).json({ error: "Missing orderId" });
        return;
      }

      const order = await fetchOrder(orderId, req.headers);
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      if (order.customerId !== customerId) {
        res.status(403).json({ error: "Forbidden: Access denied to this order" });
        return;
      }

      if (
        order.status === "CONFIRMED" ||
        order.status === "PROCESSING" ||
        order.status === "COMPLETED"
      ) {
        res.status(400).json({ error: "Order is already paid" });
        return;
      }

      const expiredAt = new Date(Date.now() + 15 * 60 * 1000);
      const transferContent = `SEPAY ${order.id.slice(0, 8)}`;
      const qrCode = `https://img.vietqr.io/image/${config.sepay.bankName}-${config.sepay.paymentAccount}-compact2.png?amount=${order.totalAmount}&addInfo=${encodeURIComponent(transferContent)}`;
      const paymentLink = `https://payment.sepay.vn/t/${order.id}`;

      const payment = await paymentRepository.createSepay(
        order.id,
        customerId,
        order.totalAmount,
        qrCode,
        transferContent,
        expiredAt
      );

      res.json({
        qrCode,
        paymentLink,
        transferContent,
        amount: payment.amount,
        expiredAt: expiredAt.toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create SePay session" });
    }
  });

  router.post("/sepay/webhook", async (req: Request, res: Response) => {
    try {
      const authHeader = String(req.header("Authorization") || "");
      const signature = req.header("x-sepay-signature") || req.header("X-SePay-Signature");
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : JSON.stringify(req.body || {});

      let authorized = false;

      // 1. Verify via API Key (Authorization: Apikey <API_KEY>)
      if (authHeader.startsWith("Apikey ")) {
        const apiKey = authHeader.substring(7).trim();
        if (apiKey === config.sepay.webhookSecret) {
          authorized = true;
        }
      }

      // 2. Verify via HMAC-SHA256 signature
      if (!authorized && signature) {
        const cleanSignature = signature.startsWith("sha256=")
          ? signature.substring(7)
          : signature;

        const expected = crypto
          .createHmac("sha256", config.sepay.webhookSecret)
          .update(rawBody)
          .digest("hex");

        if (cleanSignature === expected) {
          authorized = true;
        }
      }

      // 3. Bypass signature check for local testing / troubleshooting if configured
      if (!authorized && process.env.SEPAY_BYPASS_SIGNATURE === "true") {
        console.warn("[PaymentService] Bypassing SePay Webhook signature verification because SEPAY_BYPASS_SIGNATURE is set to true.");
        authorized = true;
      }

      if (!authorized) {
        const expected = signature ? crypto
          .createHmac("sha256", config.sepay.webhookSecret)
          .update(rawBody)
          .digest("hex") : "";
        console.warn(
          `[PaymentService] Unauthorized SePay Webhook request. Received signature: ${signature}, Expected: ${expected}. isBuffer: ${Buffer.isBuffer(req.body)}. Raw body: "${rawBody}"`
        );
        res.status(401).json({ error: "Invalid webhook signature or Apikey" });
        return;
      }

      const payload = JSON.parse(rawBody || "{}");

      const amount = Number(payload.transferAmount || payload.amount || 0);
      const transferContent = String(payload.content || payload.transferContent || payload.code || "").trim();
      const bankTransactionId = String(payload.id || payload.transactionId || payload.referenceCode || "");
      const status = String(payload.status || "SUCCESS").toUpperCase();

      if (!bankTransactionId) {
        res.status(400).json({ error: "Missing bank transaction ID" });
        return;
      }

      console.log(`[PaymentService Webhook Debug] Received transferContent: "${transferContent}", amount: ${amount}, transactionId: "${bankTransactionId}"`);
      let payment = null;
      if (payload.paymentId) {
        payment = await paymentRepository.findById(payload.paymentId);
        console.log(`[PaymentService Webhook Debug] Searched by paymentId: "${payload.paymentId}". Found:`, payment ? payment.id : "null");
      } else {
        const payments = await paymentRepository.findAll();
        console.log("[PaymentService Webhook Debug] All payments in DB:", payments.map(p => ({ id: p.id, orderId: p.orderId, amount: p.amount, transferContent: p.transferContent, status: p.status })));
        payment = payments.find(p => p.transferContent && transferContent.toUpperCase().includes(p.transferContent.trim().toUpperCase()));
        console.log(`[PaymentService Webhook Debug] Searched by transferContent. Found:`, payment ? payment.id : "null");
      }

      if (!payment) {
        res.status(404).json({ error: "Payment not found matching this transfer content" });
        return;
      }

      if (payment.status === PaymentStatus.COMPLETED) {
        await syncOperationalStatusAfterPayment(
          payment,
          PaymentStatus.COMPLETED,
          "Duplicate SePay callback resync",
          req.headers,
        );
        res.json({ ok: true, message: "Duplicate callback - already completed", duplicated: true });
        return;
      }

      if (status === "SUCCESS" || status === "COMPLETED") {
        if (amount < payment.amount) {
          res.status(400).json({ error: `Incorrect amount. Expected ${payment.amount}, received ${amount}` });
          return;
        }

        const updated = await paymentRepository.updateStatus(
          payment.id,
          PaymentStatus.COMPLETED,
          bankTransactionId,
          new Date()
        );

        const processedEvent = createEvent<PaymentProcessedEvent>(
          "PAYMENT_PROCESSED",
          config.serviceName,
          {
            orderId: payment.orderId,
            paymentId: payment.id,
            amount: payment.amount,
            transactionId: bankTransactionId,
          },
          payment.idempotencyKey,
          {
            provider: "SEPAY",
            webhook: true,
            customerId: payment.customerId,
            status: "SUCCESS",
            paidAt: new Date().toISOString(),
          },
        );

        await eventStore.append(processedEvent);
        await eventBus.publish(EVENT_CHANNELS.PAYMENT_PROCESSED, processedEvent);
        if (updated) {
          await syncOperationalStatusAfterPayment(
            updated,
            PaymentStatus.COMPLETED,
            "Payment captured by SePay webhook",
            req.headers,
          );
        }

        res.json({ success: true, ok: true, payment: updated });
        return;
      }

      const updated = await paymentRepository.updateStatus(
        payment.id,
        PaymentStatus.FAILED,
      );

      const failedEvent = createEvent<PaymentFailedEvent>(
        "PAYMENT_FAILED",
        config.serviceName,
        {
          orderId: payment.orderId,
          paymentId: payment.id,
          reason: payload.reason || "SePay webhook reported failure",
          retryable: false,
        },
        payment.idempotencyKey,
        {
          provider: "SEPAY",
          webhook: true,
          customerId: payment.customerId,
          status: "FAILED",
        },
      );

      await eventStore.append(failedEvent);
      await eventBus.publish(EVENT_CHANNELS.PAYMENT_FAILED, failedEvent);
      if (updated) {
        await syncOperationalStatusAfterPayment(
          updated,
          PaymentStatus.FAILED,
          payload.reason || "SePay webhook reported failure",
          req.headers,
        );
      }

      res.json({ ok: true, payment: updated });
    } catch (error) {
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  router.post("/sepay/simulate", async (req: Request, res: Response) => {
    try {
      const { paymentId, status } = req.body || {};
      if (!paymentId) {
        res.status(400).json({ error: "Missing paymentId" });
        return;
      }

      const payment = await paymentRepository.findById(paymentId);
      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      const transactionId = `TXN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const payload = {
        orderId: payment.orderId,
        customerId: payment.customerId,
        paymentId: payment.id,
        transactionId,
        amount: payment.amount,
        status: status || "SUCCESS",
        reason: "Simulated payment via development trigger",
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac("sha256", config.sepay.webhookSecret)
        .update(rawBody)
        .digest("hex");

      const port = config.port;
      const webhookUrl = `http://localhost:${port}${config.sepay.webhookPath}`;

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sepay-signature": signature,
        },
        body: rawBody,
      });

      if (!response.ok) {
        throw new Error(`Webhook simulation failed with status ${response.status}`);
      }

      const result = await response.json();
      res.json({ ok: true, result });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
