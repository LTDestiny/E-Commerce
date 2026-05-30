// ==========================================
// @ecommerce/shared - Public API
// ==========================================

// Types
export * from "./types/order";
export * from "./types/payment";
export * from "./types/inventory";
export * from "./types/shipping";
export * from "./types/notification";
export * from "./types/events";

// Events
export { RedisEventBus, createEvent } from "./events/event-bus";
export type { IEventBus, EventHandler } from "./events/event-bus";
export { InMemoryEventStore } from "./events/event-store";
export type { IEventStore, StoredEvent } from "./events/event-store";

// Utils
export {
  generateId,
  sleep,
  retryWithBackoff,
  IdempotencyStore,
  RedisIdempotencyStore,
  CircuitBreaker,
  CircuitState,
} from "./utils";

export { createIdempotencyMiddleware } from "./utils/idempotency-middleware";

// Kafka
export { KafkaClient } from "./kafka/client";
export { KafkaEventBus } from "./events/event-bus";
export { produceMessage } from "./kafka/producer";
