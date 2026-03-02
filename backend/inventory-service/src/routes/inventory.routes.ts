// ==========================================
// Inventory Service Routes
// ==========================================

import { Router, Request, Response } from "express";
import { IEventBus, IEventStore } from "@ecommerce/shared";
import { inventoryRepository } from "../models/inventory.repository";

export function createInventoryRoutes(
  _eventBus: IEventBus,
  _eventStore: IEventStore,
): Router {
  const router = Router();

  // GET /api/inventory - List all products
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const items = await inventoryRepository.findAll();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/inventory/alerts/low-stock - Low stock alerts (MUST be before /:productId)
  router.get("/alerts/low-stock", async (_req: Request, res: Response) => {
    try {
      const lowStock = await inventoryRepository.getLowStockItems();
      res.json(lowStock);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/inventory/:productId - Get product stock
  router.get("/:productId", async (req: Request, res: Response) => {
    try {
      const item = await inventoryRepository.findByProductId(
        req.params.productId,
      );
      if (!item) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
