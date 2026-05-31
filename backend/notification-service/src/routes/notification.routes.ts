// ==========================================
// Notification Service Routes
// ==========================================

import { Router, Request, Response } from "express";
import { IEventBus, IEventStore, NotificationStatus } from "@ecommerce/shared";
import { notificationRepository } from "../models/notification.repository";

export function createNotificationRoutes(
  _eventBus: IEventBus,
  _eventStore: IEventStore,
): Router {
  const router = Router();
  const transitions: Record<string, string[]> = {
    PENDING: ["SENT", "FAILED", "CANCELLED"],
    QUEUED: ["SENT", "FAILED", "CANCELLED"],
    FAILED: ["PENDING", "QUEUED", "CANCELLED"],
    SENT: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  };

  // GET /api/notifications - List notifications for the authenticated customer
  router.get("/", async (req: Request, res: Response) => {
    try {
      const customerId = req.headers["x-user-id"];
      if (!customerId) {
        res.status(401).json({ error: "Missing identity header" });
        return;
      }
      
      const userRole = String(req.headers["x-user-role"] || "");
      const notifications = userRole === "ADMIN"
        ? await notificationRepository.findAll()
        : await notificationRepository.findByCustomerId(String(customerId));
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

  // GET /api/notifications/:id - Notification detail
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const notification = await notificationRepository.findById(req.params.id);
      if (!notification) {
        res.status(404).json({ error: "Notification not found" });
        return;
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/notifications/:id/resend - Mark as sent again for admin resend flow
  router.post("/:id/resend", async (req: Request, res: Response) => {
    try {
      const notification = await notificationRepository.updateStatus(
        req.params.id,
        NotificationStatus.SENT,
      );
      if (!notification) {
        res.status(404).json({ error: "Notification not found" });
        return;
      }
      res.json({ ok: true, notification });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/notifications/:id/status - Admin status control
  router.patch("/:id/status", async (req: Request, res: Response) => {
    try {
      if (String(req.headers["x-user-role"] || "") !== "ADMIN") {
        res.status(403).json({ error: "Admin role is required" });
        return;
      }

      const notification = await notificationRepository.findById(req.params.id);
      if (!notification) {
        res.status(404).json({ error: "Notification not found" });
        return;
      }

      const requestedStatus = String(req.body?.status || "").toUpperCase();
      const reason = String(req.body?.reason || "").trim();
      if (!Object.values(NotificationStatus).includes(requestedStatus as NotificationStatus)) {
        res.status(400).json({ error: "Invalid notification status" });
        return;
      }

      const currentStatus = String(notification.status || "PENDING").toUpperCase();
      if (!(transitions[currentStatus] || []).includes(requestedStatus)) {
        res.status(409).json({ error: `Transition ${currentStatus} -> ${requestedStatus} is not allowed` });
        return;
      }

      if (["FAILED", "CANCELLED"].includes(requestedStatus) && !reason) {
        res.status(400).json({ error: "Reason is required for failed notification status changes" });
        return;
      }

      const updated = await notificationRepository.updateStatus(
        notification.id,
        requestedStatus as NotificationStatus,
      );
      res.json(updated);
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
