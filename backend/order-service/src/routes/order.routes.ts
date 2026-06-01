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

async function fetchPaymentByOrder(orderId: string): Promise<any> {
  const urls = [
    `http://ecommerce-payment-service:4002/api/payments/order/${orderId}`,
    `http://payment-service:4002/api/payments/order/${orderId}`,
    `http://localhost:4002/api/payments/order/${orderId}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      // Try the next service alias.
    }
  }

  return null;
}

async function fetchShipmentByOrder(orderId: string): Promise<any> {
  const urls = [
    `http://ecommerce-shipping-service:4004/api/shipments/order/${orderId}`,
    `http://shipping-service:4004/api/shipments/order/${orderId}`,
    `http://localhost:4004/api/shipments/order/${orderId}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      // Try the next service alias.
    }
  }

  return null;
}

async function patchRelatedStatus(
  urls: string[],
  status: string,
  reason: string,
  clientHeaders?: any,
  extra: Record<string, unknown> = {},
) {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          ...serviceHeaders(clientHeaders),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, reason, ...extra }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Try the next service alias.
    }
  }

  return null;
}

async function syncRelatedAfterOrderStatus(order: any, status: string, reason: string, clientHeaders?: any) {
  const normalized = status.toUpperCase();
  const payment = await fetchPaymentByOrder(order.id);
  const shipment = await fetchShipmentByOrder(order.id);

  const patchPayment = (nextStatus: string, extra: Record<string, unknown> = {}) =>
    payment
      ? patchRelatedStatus(
          [
            `http://ecommerce-payment-service:4002/api/payments/${payment.id}/status`,
            `http://payment-service:4002/api/payments/${payment.id}/status`,
            `http://localhost:4002/api/payments/${payment.id}/status`,
          ],
          nextStatus,
          reason,
          clientHeaders,
          extra,
        )
      : null;

  const patchShipment = (nextStatus: string, extra: Record<string, unknown> = {}) =>
    shipment
      ? patchRelatedStatus(
          [
            `http://ecommerce-shipping-service:4004/api/shipments/${shipment.id}/status`,
            `http://shipping-service:4004/api/shipments/${shipment.id}/status`,
            `http://localhost:4004/api/shipments/${shipment.id}/status`,
          ],
          nextStatus,
          reason,
          clientHeaders,
          extra,
        )
      : null;

  if (normalized === "CONFIRMED") {
    if (payment && String(payment.status).toUpperCase() === "PENDING") {
      await patchPayment("COMPLETED", { transactionId: `ADMIN-${Date.now()}` });
    }
    return;
  }

  if (normalized === "PROCESSING") {
    if (payment && String(payment.status).toUpperCase() === "PENDING") {
      await patchPayment("COMPLETED", { transactionId: `ADMIN-${Date.now()}` });
    }
    if (shipment && String(shipment.status).toUpperCase() === "PENDING") {
      await patchShipment("READY");
    }
    return;
  }

  if (normalized === "COMPLETED") {
    if (payment && String(payment.status).toUpperCase() === "PENDING") {
      await patchPayment("COMPLETED", { transactionId: `ADMIN-${Date.now()}` });
    }
    if (shipment && ["PENDING", "READY", "IN_TRANSIT", "DELAYED"].includes(String(shipment.status).toUpperCase())) {
      const current = String(shipment.status).toUpperCase();
      if (current === "PENDING") await patchShipment("READY");
      if (["PENDING", "READY"].includes(current)) await patchShipment("IN_TRANSIT", { trackingNumber: shipment.trackingNumber || `ADMIN-${Date.now()}` });
      await patchShipment("DELIVERED");
    }
    return;
  }

  if (normalized === "CANCELLED") {
    if (payment) {
      const paymentStatus = String(payment.status).toUpperCase();
      await patchPayment(paymentStatus === "COMPLETED" ? "REFUNDED" : "CANCELLED");
    }
    if (shipment && !["DELIVERED", "CANCELLED"].includes(String(shipment.status).toUpperCase())) {
      await patchShipment("CANCELLED");
    }
    return;
  }

  if (normalized === "FAILED") {
    if (payment && String(payment.status).toUpperCase() === "PENDING") {
      await patchPayment("FAILED");
    }
    if (shipment && !["DELIVERED", "CANCELLED", "FAILED"].includes(String(shipment.status).toUpperCase())) {
      await patchShipment("FAILED");
    }
  }
}

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
      const reason = String(req.body?.reason || "").trim();
      if (!Object.values(OrderStatus).includes(requestedStatus as OrderStatus)) {
        res.status(400).json({ error: "Invalid order status" });
        return;
      }
      const existing = await orderRepository.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      const transitions: Record<string, string[]> = {
        PENDING: ["CONFIRMED", "CANCELLED", "FAILED"],
        CONFIRMED: ["PROCESSING", "CANCELLED"],
        PROCESSING: ["COMPLETED", "CANCELLED", "FAILED"],
        FAILED: ["PENDING", "CANCELLED"],
        COMPLETED: [],
        CANCELLED: [],
      };

      if (!(transitions[existing.status] || []).includes(requestedStatus)) {
        res.status(409).json({ error: `Transition ${existing.status} -> ${requestedStatus} is not allowed` });
        return;
      }

      if (["CANCELLED", "FAILED"].includes(requestedStatus) && !reason) {
        res.status(400).json({ error: "Reason is required for sensitive order status changes" });
        return;
      }

      const order = await orderRepository.updateStatus(req.params.id, requestedStatus as OrderStatus);
      if (!order) {
        res.status(404).json({ error: "Order not found" });
        return;
      }

      await syncRelatedAfterOrderStatus(
        order,
        requestedStatus,
        reason || `Order ${requestedStatus.toLowerCase()} via admin status control`,
        req.headers,
      );

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
