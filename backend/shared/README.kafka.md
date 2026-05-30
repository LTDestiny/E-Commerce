## Kafka usage (shared)

Producer helper

```ts
import { produceMessage } from "@ecommerce/shared/kafka/producer";

await produceMessage(
  process.env.KAFKA_BOOTSTRAP_SERVERS!,
  process.env.KAFKA_CLIENT_ID || "script",
  "order.placed",
  "key1",
  { foo: "bar" },
);
```

Event Bus (recommended)

```ts
import { KafkaEventBus, createEvent, EVENT_CHANNELS } from "@ecommerce/shared";

const bus = new KafkaEventBus(
  process.env.KAFKA_BOOTSTRAP_SERVERS!,
  "OrderService",
);
const event = createEvent("ORDER_PLACED", "OrderService", {
  /* payload */
});
await bus.publish(EVENT_CHANNELS.ORDER_PLACED, event);

// subscribe
await bus.subscribe(EVENT_CHANNELS.ORDER_PLACED, async (evt) => {
  // handler logic
});
```

DLQ & retries

- `KafkaEventBus` will retry handlers (env KAFKA_MAX_RETRIES, KAFKA_RETRY_BASE_MS) and send to `<topic>.dlq` after retries fail.
