// ==========================================
// Event Bus - Pub/Sub Abstraction
// ==========================================
// Development: Redis Pub/Sub
// Production: Swap to Apache Kafka / RabbitMQ
// ==========================================

import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import { BaseEvent, DomainEvent } from "../types/events";
import { KafkaClient } from "../kafka/client";

export type EventHandler<T extends BaseEvent = DomainEvent> = (
  event: T,
) => Promise<void>;

export interface IEventBus {
  publish(channel: string, event: DomainEvent): Promise<void>;
  subscribe(channel: string, handler: EventHandler): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Kafka-based Event Bus with DLQ support
 */
export class KafkaEventBus implements IEventBus {
  private client: KafkaClient;
  private producer: any;
  private consumers: Map<string, any> = new Map();
  private handlers: Map<string, EventHandler[]> = new Map();
  private serviceName: string;
  private dlqSuffix = ".dlq";
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(
    bootstrapServers: string,
    serviceName: string,
    options?: { maxRetries?: number; baseDelayMs?: number; dlqSuffix?: string },
  ) {
    const brokers = bootstrapServers.split(",").map((s) => s.trim());
    this.client = new KafkaClient({ brokers, clientId: serviceName });
    this.serviceName = serviceName;
    this.maxRetries =
      options?.maxRetries ?? parseInt(process.env.KAFKA_MAX_RETRIES || "3", 10);
    this.baseDelayMs =
      options?.baseDelayMs ??
      parseInt(process.env.KAFKA_RETRY_BASE_MS || "1000", 10);
    if (options?.dlqSuffix) this.dlqSuffix = options.dlqSuffix;
  }

  async publish(channel: string, event: DomainEvent): Promise<void> {
    if (!this.producer) this.producer = await this.client.createProducer();
    const message = JSON.stringify(event);
    await this.producer.send({
      topic: channel,
      messages: [{ key: event.id, value: message }],
    });
    console.log(
      `[${this.serviceName}] Published event: ${event.type} to ${channel}`,
    );
  }

  async subscribe(channel: string, handler: EventHandler): Promise<void> {
    const handlers = this.handlers.get(channel) || [];
    handlers.push(handler);
    this.handlers.set(channel, handlers);

    // create consumer for this channel if not exists
    if (!this.consumers.has(channel)) {
      const consumer = await this.client.createConsumer(
        `${this.serviceName}-${channel}`,
      );
      await consumer.subscribe({ topic: channel, fromBeginning: false });
      await consumer.run({
        eachMessage: async ({ topic, partition, message }: any) => {
          const value = message.value?.toString();
          if (!value) return;
          const event = JSON.parse(value) as DomainEvent;
          const hs = this.handlers.get(topic) || [];
          for (const h of hs) {
            try {
              await this.handleWithRetry(h, event, topic);
            } catch (err) {
              console.error(
                `[${this.serviceName}] Handler failed after retries, sending to DLQ`,
                err,
              );
              await this.sendToDlq(
                topic,
                message.key?.toString() ?? null,
                value,
              );
            }
          }
        },
      });
      this.consumers.set(channel, consumer);
      console.log(
        `[${this.serviceName}] Subscribed to Kafka topic: ${channel}`,
      );
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    const consumer = this.consumers.get(channel);
    if (consumer) {
      await consumer.disconnect();
      this.consumers.delete(channel);
      this.handlers.delete(channel);
    }
  }

  async disconnect(): Promise<void> {
    if (this.producer) await this.producer.disconnect();
    for (const c of this.consumers.values()) {
      try {
        await c.disconnect();
      } catch {}
    }
    console.log(`[${this.serviceName}] KafkaEventBus disconnected`);
  }

  private async handleWithRetry(
    handler: EventHandler,
    event: DomainEvent,
    topic: string,
  ) {
    const maxRetries = this.maxRetries ?? 3;
    const baseDelay = this.baseDelayMs ?? 1000;
    let attempt = 0;
    while (true) {
      try {
        await handler(event);
        return;
      } catch (err) {
        attempt++;
        if (attempt > maxRetries) throw err;
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(
          `[${this.serviceName}] Retrying handler for ${event.type} in ${delay}ms (attempt ${attempt})`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  private async sendToDlq(topic: string, key: string | null, value: string) {
    if (!this.producer) this.producer = await this.client.createProducer();
    const dlqTopic = `${topic}${this.dlqSuffix}`;
    await this.producer.send({
      topic: dlqTopic,
      messages: [{ key: key ?? undefined, value }],
    });
  }
}

export class RedisEventBus implements IEventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private dlqPublisher: Redis;
  private handlers: Map<string, EventHandler[]> = new Map();
  private serviceName: string;
  private dlqPrefix: string;
  private maxRetries: number;
  private retryBaseDelayMs: number;

  constructor(redisUrl: string, serviceName: string) {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    this.dlqPublisher = new Redis(redisUrl);
    this.serviceName = serviceName;
    this.dlqPrefix = process.env.REDIS_DLQ_PREFIX || "dlq:";
    this.maxRetries = parseInt(process.env.REDIS_EVENT_MAX_RETRIES || "3", 10);
    this.retryBaseDelayMs = parseInt(
      process.env.REDIS_EVENT_RETRY_BASE_MS || "1000",
      10,
    );

    this.subscriber.on("message", (channel: string, message: string) => {
      this.handleMessage(channel, message);
    });

    console.log(`[${this.serviceName}] EventBus connected to Redis`);
  }

  async publish(channel: string, event: DomainEvent): Promise<void> {
    const message = JSON.stringify(event);
    await this.publisher.publish(channel, message);
    console.log(
      `[${this.serviceName}] Published event: ${event.type} to ${channel}`,
    );
  }

  async subscribe(channel: string, handler: EventHandler): Promise<void> {
    const handlers = this.handlers.get(channel) || [];
    handlers.push(handler);
    this.handlers.set(channel, handlers);

    await this.subscriber.subscribe(channel);
    console.log(`[${this.serviceName}] Subscribed to: ${channel}`);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel);
    await this.subscriber.unsubscribe(channel);
    console.log(`[${this.serviceName}] Unsubscribed from: ${channel}`);
  }

  async disconnect(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
    await this.dlqPublisher.quit();
    console.log(`[${this.serviceName}] EventBus disconnected`);
  }

  private async handleMessage(channel: string, message: string): Promise<void> {
    const handlers = this.handlers.get(channel);
    if (!handlers || handlers.length === 0) return;

    try {
      const event = JSON.parse(message) as DomainEvent;
      console.log(
        `[${this.serviceName}] Received event: ${event.type} from ${channel}`,
      );

      for (const handler of handlers) {
        try {
          await this.handleWithRetry(handler, event, channel);
        } catch (error) {
          console.error(
            `[${this.serviceName}] Error handling event ${event.type}:`,
            error,
          );
          await this.publishToDlq(channel, event, error);
        }
      }
    } catch (error) {
      console.error(
        `[${this.serviceName}] Error parsing message from ${channel}:`,
        error,
      );
      await this.publishToDlq(channel, {
        id: uuidv4(),
        type: "EVENT_PARSE_FAILED" as DomainEvent["type"],
        source: this.serviceName,
        timestamp: new Date().toISOString(),
        correlationId: uuidv4(),
        payload: { channel, rawMessage: message },
        metadata: { error: (error as Error)?.message || "parse error" },
      } as unknown as DomainEvent, error);
    }
  }

  private async handleWithRetry(
    handler: EventHandler,
    event: DomainEvent,
    channel: string,
  ): Promise<void> {
    let attempt = 0;
    while (true) {
      try {
        await handler(event);
        return;
      } catch (error) {
        attempt++;
        if (attempt > this.maxRetries) throw error;
        const delay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `[${this.serviceName}] Retrying ${event.type} from ${channel} in ${delay}ms (attempt ${attempt})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async publishToDlq(
    channel: string,
    event: DomainEvent,
    error: unknown,
  ): Promise<void> {
    try {
      const dlqChannel = `${this.dlqPrefix}${channel}`;
      const dlqEvent: DomainEvent = {
        ...event,
        metadata: {
          ...(event.metadata || {}),
          dlq: true,
          originalChannel: channel,
          error: error instanceof Error ? error.message : String(error),
          failedAt: new Date().toISOString(),
        },
      };
      await this.dlqPublisher.publish(dlqChannel, JSON.stringify(dlqEvent));
      console.error(
        `[${this.serviceName}] Published failed event ${event.type} to DLQ channel ${dlqChannel}`,
      );
    } catch (dlqError) {
      console.error(
        `[${this.serviceName}] Failed to publish event ${event.type} to DLQ:`,
        dlqError,
      );
    }
  }
}

// ----- Helper to create events -----
export function createEvent<T extends DomainEvent>(
  type: T["type"],
  source: string,
  payload: T["payload"],
  correlationId?: string,
  metadata?: Record<string, unknown>,
): T {
  return {
    id: uuidv4(),
    type,
    source,
    timestamp: new Date().toISOString(),
    correlationId: correlationId || uuidv4(),
    payload,
    metadata,
  } as T;
}
