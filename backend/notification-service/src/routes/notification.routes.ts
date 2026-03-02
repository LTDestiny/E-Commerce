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

  // GET /api/notifications - List all notifications
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const notifications = await notificationRepository.findAll();
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

  return router;
}
