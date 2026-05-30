// ==========================================
// Inventory Event Handlers
// Listens to ORDER_PLACED → Reserve stock
// Listens to ORDER_CANCELLED → Release stock (Compensating Transaction)
// ==========================================

import {
  DomainEvent,
  EVENT_CHANNELS,
  IEventBus,
  IEventStore,
  createEvent,
  StockReservedEvent,
  StockReservationFailedEvent,
  StockReleasedEvent,
  LowStockAlertEvent,
  sleep,
  IdempotencyStore,
  RedisIdempotencyStore,
} from "@ecommerce/shared";
import { inventoryRepository } from "../models/inventory.repository";
import { config } from "../config";

export function registerEventHandlers(
  eventBus: IEventBus,
  eventStore: IEventStore,
): void {
  const idempotencyStore = process.env.REDIS_URL
    ? new RedisIdempotencyStore(process.env.REDIS_URL)
    : new IdempotencyStore();
  // ----- Listen: Order Placed → Reserve Stock -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_PLACED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_PLACED") return;
      await eventStore.append(event);

      try {
        const { orderId, items } = event.payload;

        const idempotencyKey = `inventory-${orderId}`;
        if (await idempotencyStore.check(idempotencyKey)) {
          console.log(
            `[${config.serviceName}] Duplicate inventory request for ${orderId} - skipped`,
          );
          return;
        }

        // Simulate processing
        await sleep(config.simulation.processingDelayMs);

        const stockItems = items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }));

        const result = await inventoryRepository.reserveStock(
          orderId,
          stockItems,
        );

        if (result.success && result.reservation) {
          const reservedEvent = createEvent<StockReservedEvent>(
            "STOCK_RESERVED",
            config.serviceName,
            {
              orderId,
              reservationId: result.reservation.id,
              items: stockItems,
            },
            event.correlationId,
          );

          await eventStore.append(reservedEvent);
          await eventBus.publish(EVENT_CHANNELS.STOCK_RESERVED, reservedEvent);

          await idempotencyStore.store(idempotencyKey, {
            reservationId: result.reservation.id,
          });

          console.log(
            `[${config.serviceName}] ✅ Stock reserved for order ${orderId}`,
          );

          // Check for low stock alerts
          const lowStockItems = await inventoryRepository.getLowStockItems();
          for (const item of lowStockItems) {
            const alertEvent = createEvent<LowStockAlertEvent>(
              "LOW_STOCK_ALERT",
              config.serviceName,
              {
                productId: item.productId,
                productName: item.productName,
                currentStock: item.availableStock,
                threshold: item.lowStockThreshold,
              },
              event.correlationId,
            );

            await eventStore.append(alertEvent);
            await eventBus.publish(EVENT_CHANNELS.LOW_STOCK_ALERT, alertEvent);
          }
        } else {
          const failedEvent = createEvent<StockReservationFailedEvent>(
            "STOCK_RESERVATION_FAILED",
            config.serviceName,
            {
              orderId,
              reason: "Insufficient stock",
              failedItems: result.failedItems || [],
            },
            event.correlationId,
          );

          await eventStore.append(failedEvent);
          await eventBus.publish(
            EVENT_CHANNELS.STOCK_RESERVATION_FAILED,
            failedEvent,
          );

          console.log(
            `[${config.serviceName}] ❌ Stock reservation failed for order ${orderId}`,
          );
        }
      } catch (err) {
        console.error(`[${config.serviceName}] Inventory handler error:`, err);
        // rethrow to let EventBus retry and move to DLQ when exhausted
        throw err;
      }
    },
  );

  // ----- Listen: Order Cancelled → Release Stock (Compensating Transaction) -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_CANCELLED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_CANCELLED") return;
      await eventStore.append(event);

      try {
        const { orderId } = event.payload;
        const released = await inventoryRepository.releaseStock(orderId);

        if (released) {
          const releasedEvent = createEvent<StockReleasedEvent>(
            "STOCK_RELEASED",
            config.serviceName,
            {
              orderId,
              reservationId: "N/A",
            },
            event.correlationId,
          );

          await eventStore.append(releasedEvent);
          await eventBus.publish(EVENT_CHANNELS.STOCK_RELEASED, releasedEvent);

          console.log(
            `[${config.serviceName}] 🔄 Stock released for cancelled order ${orderId}`,
          );
        }
      } catch (err) {
        console.error(`[${config.serviceName}] Inventory release error:`, err);
        throw err;
      }
    },
  );

  console.log(`[${config.serviceName}] Event handlers registered`);
}
