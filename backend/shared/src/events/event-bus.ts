// ==========================================
// Event Bus - Pub/Sub Abstraction
// ==========================================
// Development: Redis Pub/Sub
// Production: Swap to Apache Kafka / RabbitMQ
// ==========================================

import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import { BaseEvent, DomainEvent } from "../types/events";

export type EventHandler<T extends BaseEvent = DomainEvent> = (
  event: T,
) => Promise<void>;

export interface IEventBus {
  publish(channel: string, event: DomainEvent): Promise<void>;
  subscribe(channel: string, handler: EventHandler): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  disconnect(): Promise<void>;
}

export class RedisEventBus implements IEventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers: Map<string, EventHandler[]> = new Map();
  private serviceName: string;

  constructor(redisUrl: string, serviceName: string) {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    this.serviceName = serviceName;

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
          await handler(event);
        } catch (error) {
          console.error(
            `[${this.serviceName}] Error handling event ${event.type}:`,
            error,
          );
          // TODO: Send to Dead Letter Queue
        }
      }
    } catch (error) {
      console.error(
        `[${this.serviceName}] Error parsing message from ${channel}:`,
        error,
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
): T {
  return {
    id: uuidv4(),
    type,
    source,
    timestamp: new Date().toISOString(),
    correlationId: correlationId || uuidv4(),
    payload,
  } as T;
}
