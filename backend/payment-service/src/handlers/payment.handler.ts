// ==========================================
// Payment Event Handlers
// Listens to ORDER_PLACED → Process payment
// Pattern: Idempotency (prevent double charges)
// Pattern: Circuit Breaker (external gateway)
// ==========================================

import {
  DomainEvent,
  EVENT_CHANNELS,
  PaymentStatus,
  IEventBus,
  IEventStore,
  createEvent,
  PaymentProcessedEvent,
  PaymentFailedEvent,
  PaymentRefundedEvent,
  IdempotencyStore,
  RedisIdempotencyStore,
  CircuitBreaker,
  sleep,
  generateId,
} from "@ecommerce/shared";
import { paymentRepository } from "../models/payment.repository";
import { config } from "../config";

const idempotencyStore = process.env.REDIS_URL
  ? new RedisIdempotencyStore(process.env.REDIS_URL)
  : new IdempotencyStore();
const circuitBreaker = new CircuitBreaker(5, 30000, 3);

export function registerEventHandlers(
  eventBus: IEventBus,
  eventStore: IEventStore,
): void {
  // ----- Listen: Order Placed → Process Payment -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_PLACED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_PLACED") return;
      await eventStore.append(event);

      try {
        const { orderId, customerId, totalAmount } = event.payload;
        const idempotencyKey = `payment-${orderId}`;

        // Idempotency check: prevent double charge
        if (await idempotencyStore.check(idempotencyKey)) {
          console.log(
            `[${config.serviceName}] Duplicate payment request for order ${orderId} - skipped`,
          );
          return;
        }

        // Create payment record
        const payment = await paymentRepository.create(
          orderId,
          customerId,
          totalAmount,
        );

        try {
          // Process via circuit breaker
          await circuitBreaker.execute(async () => {
            // Simulate payment gateway processing
            await sleep(config.simulation.processingDelayMs);

            // Simulate random failure
            if (Math.random() < config.simulation.failureRate) {
              throw new Error("Payment gateway timeout");
            }
          });

          // Payment success
          const transactionId = `TXN-${generateId().slice(0, 8).toUpperCase()}`;
          await paymentRepository.updateStatus(
            payment.id,
            PaymentStatus.COMPLETED,
            transactionId,
          );

          const successEvent = createEvent<PaymentProcessedEvent>(
            "PAYMENT_PROCESSED",
            config.serviceName,
            {
              orderId,
              paymentId: payment.id,
              amount: totalAmount,
              transactionId,
            },
            event.correlationId,
          );

          await eventStore.append(successEvent);
          await eventBus.publish(EVENT_CHANNELS.PAYMENT_PROCESSED, successEvent);
          await idempotencyStore.store(idempotencyKey, { paymentId: payment.id });

          console.log(
            `[${config.serviceName}] ✅ Payment processed for order ${orderId}: ${transactionId}`,
          );
        } catch (error) {
          // Detect transient errors (gateway/timeouts) and rethrow for consumer retry/DLQ
          const msg = (error as Error).message || '';
          const isTransient = /timeout|ECONN|gateway/i.test(msg);

          await paymentRepository.updateStatus(payment.id, PaymentStatus.FAILED);

          const failEvent = createEvent<PaymentFailedEvent>(
            "PAYMENT_FAILED",
            config.serviceName,
            {
              orderId,
              paymentId: payment.id,
              reason: (error as Error).message,
              retryable: isTransient,
            },
            event.correlationId,
          );

          await eventStore.append(failEvent);
          await eventBus.publish(EVENT_CHANNELS.PAYMENT_FAILED, failEvent);

          console.log(
            `[${config.serviceName}] ❌ Payment failed for order ${orderId}: ${(error as Error).message}`,
          );

          if (isTransient) {
            // Rethrow to allow KafkaEventBus to retry and move message to DLQ after retries
            throw error;
          }
        }
      } catch (err) {
        console.error(`[${config.serviceName}] Payment handler error:`, err);
        throw err;
      }
    },
  );

  // ----- Listen: Order Cancelled → Refund -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_CANCELLED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_CANCELLED") return;
      await eventStore.append(event);

      try {
        const { orderId } = event.payload;
        const payment = await paymentRepository.findByOrderId(orderId);

        if (payment && payment.status === PaymentStatus.COMPLETED) {
          await paymentRepository.updateStatus(
            payment.id,
            PaymentStatus.REFUNDED,
          );

          const refundEvent = createEvent<PaymentRefundedEvent>(
            "PAYMENT_REFUNDED",
            config.serviceName,
            {
              orderId,
              paymentId: payment.id,
              refundAmount: payment.amount,
              reason: "Order cancelled",
            },
            event.correlationId,
          );

          await eventStore.append(refundEvent);
          await eventBus.publish(EVENT_CHANNELS.PAYMENT_REFUNDED, refundEvent);

          console.log(
            `[${config.serviceName}] 💰 Refund processed for order ${orderId}`,
          );
        }
      } catch (err) {
        console.error(`[${config.serviceName}] Refund handler error:`, err);
        throw err;
      }
    },
  );

  console.log(`[${config.serviceName}] Event handlers registered`);
}
