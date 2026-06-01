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

async function fetchOrder(orderId: string, clientHeaders?: any): Promise<any> {
  const urls = [
    `http://ecommerce-order-service:4001/api/orders/${orderId}`,
    `http://order-service:4001/api/orders/${orderId}`,
    `http://localhost:4001/api/orders/${orderId}`
  ];

  const headers: Record<string, string> = {};
  if (clientHeaders) {
    if (clientHeaders["x-user-id"]) headers["x-user-id"] = String(clientHeaders["x-user-id"]);
    if (clientHeaders["x-user-email"]) headers["x-user-email"] = String(clientHeaders["x-user-email"]);
    if (clientHeaders["x-user-role"]) headers["x-user-role"] = String(clientHeaders["x-user-role"]);
    if (clientHeaders["x-user-name"]) headers["x-user-name"] = String(clientHeaders["x-user-name"]);
  }

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

export function createPaymentRoutes(
  eventBus: IEventBus,
  eventStore: IEventStore,
): Router {
  const router = Router();

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
        order.status === "PAID" ||
        order.status === "CONFIRMED" ||
        order.status === "PAYMENT_COMPLETED"
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

      if (payment.status === PaymentStatus.COMPLETED || payment.status === "SUCCESS") {
        res.json({ ok: true, message: "Duplicate callback - already completed", duplicated: true });
        return;
      }

      if (status === "SUCCESS") {
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
