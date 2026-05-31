// ==========================================
// Order Service Routes
// ==========================================

import { Router, Request, Response } from "express";
import {
  CreateOrderRequest,
  EVENT_CHANNELS,
  IEventBus,
  IEventStore,
  OrderStatus,
  createEvent,
  OrderPlacedEvent,
  createIdempotencyMiddleware,
} from "@ecommerce/shared";
import { orderRepository } from "../models/order.repository";
import { config } from "../config";
import { protectRoute, hasRole, AuthenticatedRequest } from "../middleware/auth.middleware";

export function createOrderRoutes(
  eventBus: IEventBus,
  eventStore: IEventStore,
): Router {
  const router = Router();
  const idempotency = createIdempotencyMiddleware({
    headerName: "Idempotency-Key",
    redisUrl: process.env.REDIS_URL || null,
    ttlMs: 1000 * 60 * 5,
  }) as any;

  // POST /api/orders - Create new order
  router.post("/", protectRoute, idempotency, async (req: Request, res: Response) => {
    try {
      const request: CreateOrderRequest = req.body;
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user!;

      // Force customerId to be the authenticated user's ID
      request.customerId = user.id;

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
          paymentMethod: order.paymentMethod,
        } as any,
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

  // GET /api/orders - List orders (Users see their own, Admins see all via ?all=true)
  router.get("/", protectRoute, async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user!;
      const showAll = req.query.all === "true";
      
      let orders;
      if (user.role === "ADMIN" && showAll) {
        orders = await orderRepository.findAll();
      } else {
        orders = await orderRepository.findByCustomerId(user.id);
      }
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/orders/stats - Order statistics (ADMIN only)
  router.get("/stats", protectRoute, hasRole("ADMIN"), async (_req: Request, res: Response) => {
    try {
      const stats = await orderRepository.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/orders/my-orders - Get customer's own orders
  router.get("/my-orders", protectRoute, async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user!;
      const orders = await orderRepository.findByCustomerId(user.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/orders/:id/status - Admin status update for backoffice operations
  router.patch("/:id/status", protectRoute, hasRole("ADMIN"), async (req: Request, res: Response) => {
    try {
      const requestedStatus = String(req.body?.status || "").toUpperCase();
      if (!Object.values(OrderStatus).includes(requestedStatus as OrderStatus)) {
        res.status(400).json({ error: "Invalid order status" });
        return;
      }

      const order = await orderRepository.updateStatus(req.params.id, requestedStatus as OrderStatus);
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/orders/:id - Get order by ID (with ownership checks)
  router.get("/:id", protectRoute, async (req: Request, res: Response) => {
    try {
      const order = await orderRepository.findById(req.params.id);
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      const user = (req as AuthenticatedRequest).user!;
      if (user.role !== "ADMIN" && order.customerId !== user.id) {
        res.status(403).json({ error: "Forbidden: Access denied to this order" });
        return;
      }

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/orders/:id/events - Get order event timeline (with ownership checks)
  router.get("/:id/events", protectRoute, async (req: Request, res: Response) => {
    try {
      const order = await orderRepository.findById(req.params.id);
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      const user = (req as AuthenticatedRequest).user!;
      if (user.role !== "ADMIN" && order.customerId !== user.id) {
        res.status(403).json({ error: "Forbidden: Access denied to these events" });
        return;
      }

      // Get all events for this order's correlation
      const allEvents = await eventStore.getAllEvents(1000);
      const orderEvents = allEvents.filter(
        (e: any) =>
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
