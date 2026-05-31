// ==========================================
// Notification Service Routes
// ==========================================

import { Router, Request, Response } from "express";
import { IEventBus, IEventStore } from "@ecommerce/shared";
import { notificationRepository } from "../models/notification.repository";

export function createNotificationRoutes(
  _eventBus: IEventBus,
  _eventStore: IEventStore,
): Router {
  const router = Router();

  // GET /api/notifications - List notifications for the authenticated customer
  router.get("/", async (req: Request, res: Response) => {
    try {
      const customerId = req.headers["x-user-id"];
      if (!customerId) {
        res.status(401).json({ error: "Missing identity header" });
        return;
      }
      
      const notifications = await notificationRepository.findByCustomerId(String(customerId));
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/notifications/order/:orderId - Notifications for an order
  router.get("/order/:orderId", async (req: Request, res: Response) => {
    try {
      const notifications = await notificationRepository.findByOrderId(
        req.params.orderId,
      );
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/notifications/:id/read - Mark notification as read
  router.patch("/:id/read", async (req: Request, res: Response) => {
    try {
      const notification = await notificationRepository.markAsRead(req.params.id);
      if (!notification) {
        res.status(404).json({ error: "Notification not found" });
        return;
      }
      res.json({ ok: true, notification });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
