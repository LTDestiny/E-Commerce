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

      const payment = await paymentRepository.create(
        String(orderId),
        String(customerId),
        Number(amount),
      );

      const qrPayload = {
        provider: config.sepay.providerName,
        bankName: bankName || config.sepay.bankName,
        account: account || config.sepay.paymentAccount,
        orderId: payment.orderId,
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        template: config.sepay.qrTemplate,
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

  router.post("/sepay/webhook", async (req: Request, res: Response) => {
    try {
      const signature = String(req.header("x-sepay-signature") || "");
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : JSON.stringify(req.body || {});
      const expected = crypto
        .createHmac("sha256", config.sepay.webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (signature !== expected) {
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }

      const payload = JSON.parse(rawBody || "{}");
      const {
        orderId,
        customerId,
        paymentId,
        transactionId,
        amount,
        status,
        reason,
      } = payload || {};

      if (!orderId || !paymentId) {
        res.status(400).json({ error: "Missing orderId/paymentId" });
        return;
      }

      const payment = await paymentRepository.findById(paymentId);
      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      if (payment.status === PaymentStatus.COMPLETED) {
        res.json({ ok: true, duplicated: true });
        return;
      }

      if (String(status).toUpperCase() === "SUCCESS") {
        const updated = await paymentRepository.updateStatus(
          payment.id,
          PaymentStatus.COMPLETED,
          transactionId || `SEPAY-${payment.id.slice(0, 8)}`,
        );

        const processedEvent = createEvent<PaymentProcessedEvent>(
          "PAYMENT_PROCESSED",
          config.serviceName,
          {
            orderId,
            paymentId: payment.id,
            amount: Number(amount || payment.amount),
            transactionId: transactionId || `SEPAY-${payment.id.slice(0, 8)}`,
          },
          payment.idempotencyKey,
          {
            provider: "SEPAY",
            webhook: true,
            customerId: customerId || payment.customerId,
            status: "SUCCESS",
          },
        );

        await eventStore.append(processedEvent);
        await eventBus.publish(EVENT_CHANNELS.PAYMENT_PROCESSED, processedEvent);

        res.json({ ok: true, payment: updated });
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
          orderId,
          paymentId: payment.id,
          reason: reason || "SePay webhook reported failure",
          retryable: false,
        },
        payment.idempotencyKey,
        {
          provider: "SEPAY",
          webhook: true,
          customerId: customerId || payment.customerId,
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

  return router;
}
