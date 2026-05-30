// ==========================================
// Shipping Event Handlers
// Listens to ORDER_CONFIRMED → Schedule shipping
// ==========================================

import {
  DomainEvent,
  EVENT_CHANNELS,
  ShippingStatus,
  ShippingCarrier,
  IEventBus,
  IEventStore,
  createEvent,
  ShippingScheduledEvent,
  OrderShippedEvent,
  sleep,
  generateId,
  IdempotencyStore,
  RedisIdempotencyStore,
} from "@ecommerce/shared";
import { shipmentRepository } from "../models/shipment.repository";
import { config } from "../config";

export function registerEventHandlers(
  eventBus: IEventBus,
  eventStore: IEventStore,
): void {
  const idempotencyStore = process.env.REDIS_URL
    ? new RedisIdempotencyStore(process.env.REDIS_URL)
    : new IdempotencyStore();
  // ----- Listen: Order Confirmed → Schedule Shipping -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_CONFIRMED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_CONFIRMED") return;
      await eventStore.append(event);

      try {
        const { orderId } = event.payload;

        const idempotencyKey = `shipping-${orderId}`;
        if (await idempotencyStore.check(idempotencyKey)) {
          console.log(
            `[${config.serviceName}] Duplicate shipping request for ${orderId} - skipped`,
          );
          return;
        }

        // Simulate scheduling delay
        await sleep(config.simulation.schedulingDelayMs);

        // We need the shipping address from the original order
        // In a real system, we'd fetch this from Order Service or it would be in the event
        const shipment = await shipmentRepository.create(
          orderId,
          {
            fullName: "Khách hàng",
            phone: "0900000000",
            street: "123 Nguyễn Văn A",
            city: "TP. Hồ Chí Minh",
            state: "HCM",
            zipCode: "700000",
            country: "VN",
          },
          ShippingCarrier.GIAO_HANG_NHANH,
        );

        const scheduledEvent = createEvent<ShippingScheduledEvent>(
          "SHIPPING_SCHEDULED",
          config.serviceName,
          {
            orderId,
            shipmentId: shipment.id,
            carrier: shipment.carrier,
            estimatedDelivery: shipment.estimatedDelivery || "",
          },
          event.correlationId,
        );

        await eventStore.append(scheduledEvent);
        await eventBus.publish(
          EVENT_CHANNELS.SHIPPING_SCHEDULED,
          scheduledEvent,
        );

        await idempotencyStore.store(idempotencyKey, {
          shipmentId: shipment.id,
        });

        console.log(
          `[${config.serviceName}] ✅ Shipping scheduled for order ${orderId}`,
        );

        // Simulate automatic shipping after a delay
        setTimeout(async () => {
          const trackingNumber = `GHN-${generateId().slice(0, 10).toUpperCase()}`;
          await shipmentRepository.updateStatus(
            shipment.id,
            ShippingStatus.IN_TRANSIT,
            trackingNumber,
          );

          const shippedEvent = createEvent<OrderShippedEvent>(
            "ORDER_SHIPPED",
            config.serviceName,
            {
              orderId,
              shipmentId: shipment.id,
              trackingNumber,
            },
            event.correlationId,
          );

          await eventStore.append(shippedEvent);
          await eventBus.publish(EVENT_CHANNELS.ORDER_SHIPPED, shippedEvent);

          console.log(
            `[${config.serviceName}] 🚚 Order ${orderId} shipped: ${trackingNumber}`,
          );
        }, 5000);
      } catch (err) {
        console.error(`[${config.serviceName}] Shipping handler error:`, err);
        throw err;
      }
    },
  );

  console.log(`[${config.serviceName}] Event handlers registered`);
}
