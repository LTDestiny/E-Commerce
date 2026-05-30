// ==========================================
// Order Event Handlers
// Saga Pattern (Choreography-based):
// - Listen to StockReserved, PaymentProcessed → Confirm Order
// - Listen to failures → Cancel Order (Compensating Transaction)
// ==========================================

import {
  DomainEvent,
  OrderStatus,
  EVENT_CHANNELS,
  IEventBus,
  IEventStore,
  createEvent,
  OrderConfirmedEvent,
  OrderCancelledEvent,
} from "@ecommerce/shared";
import { orderRepository } from "../models/order.repository";
import { config } from "../config";
import { IdempotencyStore, RedisIdempotencyStore } from "@ecommerce/shared";

// Track saga state per order
const sagaState = new Map<
  string,
  { stockReserved: boolean; paymentProcessed: boolean }
>();

export function registerEventHandlers(
  eventBus: IEventBus,
  eventStore: IEventStore,
): void {
  const idempotencyStore = process.env.REDIS_URL
    ? new RedisIdempotencyStore(process.env.REDIS_URL)
    : new IdempotencyStore();
  // ----- Listen: Stock Reserved -----
  eventBus.subscribe(
    EVENT_CHANNELS.STOCK_RESERVED,
    async (event: DomainEvent) => {
      if (event.type !== "STOCK_RESERVED") return;
      await eventStore.append(event);

      try {
        const { orderId } = event.payload;

        const idempotencyKey = `order-saga-${orderId}-STOCK_RESERVED`;
        if (await idempotencyStore.check(idempotencyKey)) {
          console.log(
            `[${config.serviceName}] Duplicate STOCK_RESERVED for ${orderId} - skipped`,
          );
          return;
        }

        const state = sagaState.get(orderId) || {
          stockReserved: false,
          paymentProcessed: false,
        };
        state.stockReserved = true;
        sagaState.set(orderId, state);

        await orderRepository.updateStatus(
          orderId,
          OrderStatus.INVENTORY_RESERVED,
        );
        console.log(
          `[${config.serviceName}] Stock reserved for order ${orderId}`,
        );

        // Check if both conditions met → Confirm order
        await tryConfirmOrder(
          orderId,
          event.correlationId,
          eventBus,
          eventStore,
        );

        await idempotencyStore.store(idempotencyKey, { processed: true });
      } catch (err) {
        console.error(`[${config.serviceName}] Order handler error:`, err);
        throw err;
      }
    },
  );

  // ----- Listen: Payment Processed -----
  eventBus.subscribe(
    EVENT_CHANNELS.PAYMENT_PROCESSED,
    async (event: DomainEvent) => {
      if (event.type !== "PAYMENT_PROCESSED") return;
      await eventStore.append(event);

      try {
        const { orderId } = event.payload;

        const idempotencyKey = `order-saga-${orderId}-PAYMENT_PROCESSED`;
        if (await idempotencyStore.check(idempotencyKey)) {
          console.log(
            `[${config.serviceName}] Duplicate PAYMENT_PROCESSED for ${orderId} - skipped`,
          );
          return;
        }

        const state = sagaState.get(orderId) || {
          stockReserved: false,
          paymentProcessed: false,
        };
        state.paymentProcessed = true;
        sagaState.set(orderId, state);

        await orderRepository.updateStatus(
          orderId,
          OrderStatus.PAYMENT_COMPLETED,
        );
        console.log(
          `[${config.serviceName}] Payment processed for order ${orderId}`,
        );

        // Check if both conditions met → Confirm order
        await tryConfirmOrder(
          orderId,
          event.correlationId,
          eventBus,
          eventStore,
        );

        await idempotencyStore.store(idempotencyKey, { processed: true });
      } catch (err) {
        console.error(`[${config.serviceName}] Order handler error:`, err);
        throw err;
      }
    },
  );

  // ----- Listen: Stock Reservation Failed → Cancel Order -----
  eventBus.subscribe(
    EVENT_CHANNELS.STOCK_RESERVATION_FAILED,
    async (event: DomainEvent) => {
      if (event.type !== "STOCK_RESERVATION_FAILED") return;
      await eventStore.append(event);

      try {
        const { orderId, reason } = event.payload;
        await cancelOrder(
          orderId,
          reason,
          event.correlationId,
          eventBus,
          eventStore,
        );
      } catch (err) {
        console.error(`[${config.serviceName}] Order handler error:`, err);
        throw err;
      }
    },
  );

  // ----- Listen: Payment Failed → Release Stock (Compensating Transaction) -----
  eventBus.subscribe(
    EVENT_CHANNELS.PAYMENT_FAILED,
    async (event: DomainEvent) => {
      if (event.type !== "PAYMENT_FAILED") return;
      await eventStore.append(event);

      try {
        const { orderId, reason } = event.payload;
        await cancelOrder(
          orderId,
          `Payment failed: ${reason}`,
          event.correlationId,
          eventBus,
          eventStore,
        );
      } catch (err) {
        console.error(`[${config.serviceName}] Order handler error:`, err);
        throw err;
      }
    },
  );

  // ----- Listen: Shipping Scheduled -----
  eventBus.subscribe(
    EVENT_CHANNELS.SHIPPING_SCHEDULED,
    async (event: DomainEvent) => {
      if (event.type !== "SHIPPING_SCHEDULED") return;
      await eventStore.append(event);

      try {
        const { orderId } = event.payload;
        await orderRepository.updateStatus(
          orderId,
          OrderStatus.SHIPPING_SCHEDULED,
        );
      } catch (err) {
        console.error(`[${config.serviceName}] Order handler error:`, err);
        throw err;
      }
    },
  );

  // ----- Listen: Order Shipped -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_SHIPPED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_SHIPPED") return;
      await eventStore.append(event);

      try {
        const { orderId } = event.payload;
        await orderRepository.updateStatus(orderId, OrderStatus.SHIPPED);
      } catch (err) {
        console.error(`[${config.serviceName}] Order handler error:`, err);
        throw err;
      }
    },
  );

  // ----- Listen: Order Delivered → Complete -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_DELIVERED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_DELIVERED") return;
      await eventStore.append(event);

      try {
        const { orderId } = event.payload;
        await orderRepository.updateStatus(orderId, OrderStatus.DELIVERED);
      } catch (err) {
        console.error(`[${config.serviceName}] Order handler error:`, err);
        throw err;
      }
    },
  );

  console.log(`[${config.serviceName}] Event handlers registered`);
}

// ----- Try confirm order when both Stock & Payment are done -----
async function tryConfirmOrder(
  orderId: string,
  correlationId: string,
  eventBus: IEventBus,
  eventStore: IEventStore,
): Promise<void> {
  const state = sagaState.get(orderId);
  if (!state?.stockReserved || !state?.paymentProcessed) return;

  const order = await orderRepository.updateStatus(
    orderId,
    OrderStatus.CONFIRMED,
  );
  if (!order) return;

  const event = createEvent<OrderConfirmedEvent>(
    "ORDER_CONFIRMED",
    config.serviceName,
    { orderId, customerId: order.customerId },
    correlationId,
  );

  await eventStore.append(event);
  await eventBus.publish(EVENT_CHANNELS.ORDER_CONFIRMED, event);
  sagaState.delete(orderId);

  console.log(`[${config.serviceName}] ✅ Order ${orderId} CONFIRMED`);
}

// ----- Cancel order (Compensating Transaction) -----
async function cancelOrder(
  orderId: string,
  reason: string,
  correlationId: string,
  eventBus: IEventBus,
  eventStore: IEventStore,
): Promise<void> {
  const order = await orderRepository.updateStatus(
    orderId,
    OrderStatus.CANCELLED,
  );
  if (!order) return;

  const event = createEvent<OrderCancelledEvent>(
    "ORDER_CANCELLED",
    config.serviceName,
    { orderId, customerId: order.customerId, reason },
    correlationId,
  );

  await eventStore.append(event);
  await eventBus.publish(EVENT_CHANNELS.ORDER_CANCELLED, event);
  sagaState.delete(orderId);

  console.log(
    `[${config.serviceName}] ❌ Order ${orderId} CANCELLED: ${reason}`,
  );
}
