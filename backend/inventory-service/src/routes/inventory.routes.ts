// ==========================================
// Inventory Service Routes
// ==========================================

import { Router, Request, Response } from "express";
import { IEventBus, IEventStore } from "@ecommerce/shared";
import { inventoryRepository } from "../models/inventory.repository";
import {
  getCachedInventoryProduct,
  setCachedInventoryProduct,
} from "../lib/cache";

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
  // Redis Cache-Aside Pattern:
  // 1. Check Redis first.
  // 2. If cache hit, return cached product.
  // 3. If cache miss, read PostgreSQL, then store result in Redis with TTL.
  router.get("/:productId", async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;

      const cachedItem = await getCachedInventoryProduct(productId);

      if (cachedItem) {
        res.setHeader("X-Cache", "HIT");
        console.log(`[InventoryCache] HIT ${productId}`);
        res.json(cachedItem);
        return;
      }

      const item = await inventoryRepository.findByProductId(productId);

      if (!item) {
        res.status(404).json({ error: "Product not found" });
        return;
      }

      await setCachedInventoryProduct(productId, item);

      res.setHeader("X-Cache", "MISS");
      console.log(`[InventoryCache] MISS ${productId} -> stored in Redis`);
      res.json(item);
    } catch (error) {
      console.error("[InventoryCache] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}