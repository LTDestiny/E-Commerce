// ==========================================
// Shipping Service Routes
// ==========================================

import { Router, Request, Response } from "express";
import { IEventBus, IEventStore, ShippingStatus } from "@ecommerce/shared";
import { shipmentRepository } from "../models/shipment.repository";

function serviceHeaders(clientHeaders?: any): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!clientHeaders) return headers;
  if (clientHeaders["x-user-id"]) headers["x-user-id"] = String(clientHeaders["x-user-id"]);
  if (clientHeaders["x-user-email"]) headers["x-user-email"] = String(clientHeaders["x-user-email"]);
  if (clientHeaders["x-user-role"]) headers["x-user-role"] = String(clientHeaders["x-user-role"]);
  if (clientHeaders["x-user-name"]) headers["x-user-name"] = String(clientHeaders["x-user-name"]);
  if (clientHeaders.authorization) headers.authorization = String(clientHeaders.authorization);
  return headers;
}

async function patchOrderStatus(orderId: string, status: string, reason: string, clientHeaders?: any) {
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
    } catch {
      // Try the next service alias.
    }
  }

  return null;
}

async function syncOrderAfterShipmentStatus(shipment: any, status: string, reason: string, clientHeaders?: any) {
  const targetByShipmentStatus: Record<string, string> = {
    READY: "PROCESSING",
    IN_TRANSIT: "PROCESSING",
    DELAYED: "PROCESSING",
    DELIVERED: "COMPLETED",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
  };
  const target = targetByShipmentStatus[status.toUpperCase()];
  if (!target) return;
  await patchOrderStatus(shipment.orderId, target, reason || `Shipment ${status.toLowerCase()}`, clientHeaders);
}

export function createShippingRoutes(
  _eventBus: IEventBus,
  _eventStore: IEventStore,
): Router {
  const router = Router();
  const transitions: Record<string, string[]> = {
    PENDING: ["READY", "CANCELLED"],
    READY: ["IN_TRANSIT", "CANCELLED"],
    IN_TRANSIT: ["DELIVERED", "DELAYED", "FAILED"],
    DELAYED: ["IN_TRANSIT", "DELIVERED", "FAILED"],
    FAILED: ["PENDING", "CANCELLED"],
    DELIVERED: [],
    CANCELLED: [],
  };

  // GET /api/shipments - List all shipments
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const shipments = await shipmentRepository.findAll();
      res.json(shipments);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/shipments/order/:orderId - Get shipment by order
  router.get("/order/:orderId", async (req: Request, res: Response) => {
    try {
      const shipment = await shipmentRepository.findByOrderId(
        req.params.orderId,
      );
      if (!shipment) {
        res.status(404).json({ error: "Shipment not found for this order" });
        return;
      }
      res.json(shipment);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/shipments/:id - Get shipment by ID
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const shipment = await shipmentRepository.findById(req.params.id);
      if (!shipment) {
        res.status(404).json({ error: "Shipment not found" });
        return;
      }
      res.json(shipment);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/shipments/:id/status - Admin status control
  router.patch("/:id/status", async (req: Request, res: Response) => {
    try {
      if (String(req.headers["x-user-role"] || "") !== "ADMIN") {
        res.status(403).json({ error: "Admin role is required" });
        return;
      }

      const shipment = await shipmentRepository.findById(req.params.id);
      if (!shipment) {
        res.status(404).json({ error: "Shipment not found" });
        return;
      }

      const requestedStatus = String(req.body?.status || "").toUpperCase();
      const reason = String(req.body?.reason || "").trim();
      if (!Object.values(ShippingStatus).includes(requestedStatus as ShippingStatus)) {
        res.status(400).json({ error: "Invalid shipment status" });
        return;
      }

      const currentStatus = String(shipment.status || "PENDING").toUpperCase();
      if (!(transitions[currentStatus] || []).includes(requestedStatus)) {
        res.status(409).json({ error: `Transition ${currentStatus} -> ${requestedStatus} is not allowed` });
        return;
      }

      if (["FAILED", "CANCELLED", "DELAYED"].includes(requestedStatus) && !reason) {
        res.status(400).json({ error: "Reason is required for sensitive shipment status changes" });
        return;
      }

      const updated = await shipmentRepository.updateStatus(
        shipment.id,
        requestedStatus as ShippingStatus,
        req.body?.trackingNumber || shipment.trackingNumber,
      );
      if (updated) {
        await syncOrderAfterShipmentStatus(
          updated,
          requestedStatus,
          reason || `Shipment ${requestedStatus.toLowerCase()} via admin status control`,
          req.headers,
        );
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
