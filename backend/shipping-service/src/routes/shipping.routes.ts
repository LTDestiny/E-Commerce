// ==========================================
// Shipping Service Routes
// ==========================================

import { Router, Request, Response } from "express";
import { IEventBus, IEventStore } from "@ecommerce/shared";
import { shipmentRepository } from "../models/shipment.repository";

export function createShippingRoutes(
  _eventBus: IEventBus,
  _eventStore: IEventStore,
): Router {
  const router = Router();

  // GET /api/shipments - List all shipments
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const shipments = await shipmentRepository.findAll();
      res.json(shipments);
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

  return router;
}
