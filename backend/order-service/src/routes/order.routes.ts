// ==========================================
// Order Service Routes
// ==========================================

import { Router, Request, Response } from "express";
import {
  CreateOrderRequest,
  EVENT_CHANNELS,
  IEventBus,
  IEventStore,
  createEvent,
  OrderPlacedEvent,
  createIdempotencyMiddleware,
} from "@ecommerce/shared";
import { orderRepository } from "../models/order.repository";
import { config } from "../config";

export function createOrderRoutes(
  eventBus: IEventBus,
  eventStore: IEventStore,
): Router {
  const router = Router();
  const idempotency = createIdempotencyMiddleware({
    headerName: "Idempotency-Key",
    redisUrl: process.env.REDIS_URL || null,
    ttlMs: 1000 * 60 * 5,
  });

  // POST /api/orders - Create new order
  router.post("/", idempotency, async (req: Request, res: Response) => {
    try {
      const request: CreateOrderRequest = req.body;

      // Validate
      if (
        !request.customerId ||
        !request.items?.length ||
        !request.shippingAddress
      ) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      // Create order
      const order = await orderRepository.create(request);

      // Publish ORDER_PLACED event → triggers Saga
      const event = createEvent<OrderPlacedEvent>(
        "ORDER_PLACED",
        config.serviceName,
        {
          orderId: order.id,
          customerId: order.customerId,
          items: order.items,
          totalAmount: order.totalAmount,
          shippingAddress: order.shippingAddress,
        },
      );

      await eventStore.append(event);
      await eventBus.publish(EVENT_CHANNELS.ORDER_PLACED, event);

      console.log(
        `[${config.serviceName}] Order created: ${order.id} ($${order.totalAmount})`,
      );

      res.status(201).json(order);
    } catch (error) {
      console.error(`[${config.serviceName}] Error creating order:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/orders - List all orders
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const orders = await orderRepository.findAll();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/orders/stats - Order statistics
  router.get("/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await orderRepository.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/orders/:id - Get order by ID
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const order = await orderRepository.findById(req.params.id);
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/orders/:id/events - Get order event timeline
  router.get("/:id/events", async (req: Request, res: Response) => {
    try {
      const order = await orderRepository.findById(req.params.id);
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      // Get all events for this order's correlation
      const allEvents = await eventStore.getAllEvents(1000);
      const orderEvents = allEvents.filter(
        (e) =>
          "orderId" in (e.event as any).payload &&
          (e.event as any).payload.orderId === req.params.id,
      );

      res.json(orderEvents);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
