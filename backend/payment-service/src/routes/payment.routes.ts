// ==========================================
// Payment Service Routes
// ==========================================

import { Router, Request, Response } from "express";
import { IEventBus, IEventStore } from "@ecommerce/shared";
import { paymentRepository } from "../models/payment.repository";

export function createPaymentRoutes(
  _eventBus: IEventBus,
  _eventStore: IEventStore,
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

  return router;
}
