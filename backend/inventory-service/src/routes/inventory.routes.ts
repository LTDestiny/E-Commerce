// ==========================================
// Inventory Service Routes
// ==========================================

import { Router, Request, Response } from "express";
import Redis from "ioredis";
import {
  EVENT_CHANNELS,
  IEventBus,
  IEventStore,
  ProductCreatedEvent,
  createEvent,
} from "@ecommerce/shared";
import { inventoryRepository } from "../models/inventory.repository";
import {
  getCachedInventoryProduct,
  setCachedInventoryProduct,
} from "../lib/cache";
import { config } from "../config";

const realtimePublisher = new Redis(config.redis.url);

export function createInventoryRoutes(
  eventBus: IEventBus,
  eventStore: IEventStore,
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

  // POST /api/inventory - Admin creates a new catalog product
  router.post("/", async (req: Request, res: Response) => {
    try {
      if (String(req.headers["x-user-role"] || "") !== "ADMIN") {
        res.status(403).json({ error: "Admin role is required" });
        return;
      }

      const body = req.body || {};
      const productId = String(body.productId || "").trim().toUpperCase();
      const productName = String(body.productName || "").trim();
      const totalStock = Number(body.totalStock);
      const lowStockThreshold = body.lowStockThreshold === undefined
        ? 10
        : Number(body.lowStockThreshold);
      const price = body.price === undefined ? undefined : Number(body.price);

      if (!productId || !productName) {
        res.status(400).json({ error: "productId and productName are required" });
        return;
      }

      if (!Number.isInteger(totalStock) || totalStock < 0) {
        res.status(400).json({ error: "totalStock must be a non-negative integer" });
        return;
      }

      if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
        res.status(400).json({ error: "lowStockThreshold must be a non-negative integer" });
        return;
      }

      if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
        res.status(400).json({ error: "price must be a non-negative number" });
        return;
      }

      const existing = await inventoryRepository.findByProductId(productId);
      if (existing) {
        res.status(409).json({ error: "Product ID already exists" });
        return;
      }

      const specs = Array.isArray(body.specs)
        ? body.specs.map((item: unknown) => String(item).trim()).filter(Boolean)
        : String(body.specs || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

      const item = await inventoryRepository.createProduct({
        productId,
        productName,
        totalStock,
        lowStockThreshold,
        price,
        category: body.category ? String(body.category).trim() : undefined,
        shortDescription: body.shortDescription ? String(body.shortDescription).trim() : undefined,
        description: body.description ? String(body.description).trim() : undefined,
        specs,
        accentClass: body.accentClass ? String(body.accentClass).trim() : undefined,
        rating: body.rating === undefined ? undefined : Number(body.rating),
        sold: body.sold === undefined ? undefined : Number(body.sold),
        warranty: body.warranty ? String(body.warranty).trim() : undefined,
        image: body.image ? String(body.image).trim() : undefined,
      });

      const event = createEvent<ProductCreatedEvent>(
        "PRODUCT_CREATED",
        config.serviceName,
        {
          productId: item.productId,
          productName: item.productName,
          totalStock: item.totalStock,
          availableStock: item.availableStock,
          price: item.price,
          category: item.category,
          image: item.image,
        },
        undefined,
        {
          actorId: req.headers["x-user-id"] || "admin",
          actorRole: req.headers["x-user-role"] || "ADMIN",
        },
      );

      await eventStore.append(event);
      await eventBus.publish(EVENT_CHANNELS.PRODUCT_CREATED, event);
      await realtimePublisher.publish("inventory.events", JSON.stringify(event));

      res.status(201).json(item);
    } catch (error) {
      console.error("[InventoryService] Error creating product:", error);
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
