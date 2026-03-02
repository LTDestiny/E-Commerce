// ==========================================
// Event Store - Event Sourcing Pattern
// ==========================================
// Lưu trữ tất cả events để:
// - Audit trail
// - Replay events
// - Rebuild state
// ==========================================

import { DomainEvent } from "../types/events";

export interface StoredEvent {
  sequenceNumber: number;
  event: DomainEvent;
  storedAt: string;
}

export interface IEventStore {
  append(event: DomainEvent): Promise<void>;
  getEvents(correlationId: string): Promise<StoredEvent[]>;
  getEventsByType(eventType: string): Promise<StoredEvent[]>;
  getAllEvents(limit?: number, offset?: number): Promise<StoredEvent[]>;
  getEventCount(): Promise<number>;
}

/**
 * In-Memory Event Store for development
 * Production: Replace with EventStoreDB / Kafka / PostgreSQL
 */
export class InMemoryEventStore implements IEventStore {
  private events: StoredEvent[] = [];
  private sequence = 0;

  async append(event: DomainEvent): Promise<void> {
    this.sequence++;
    const storedEvent: StoredEvent = {
      sequenceNumber: this.sequence,
      event,
      storedAt: new Date().toISOString(),
    };
    this.events.push(storedEvent);
    console.log(
      `[EventStore] Event #${this.sequence} stored: ${event.type} (${event.correlationId})`,
    );
  }

  async getEvents(correlationId: string): Promise<StoredEvent[]> {
    return this.events.filter((e) => e.event.correlationId === correlationId);
  }

  async getEventsByType(eventType: string): Promise<StoredEvent[]> {
    return this.events.filter((e) => e.event.type === eventType);
  }

  async getAllEvents(limit = 100, offset = 0): Promise<StoredEvent[]> {
    return this.events.slice(offset, offset + limit);
  }

  async getEventCount(): Promise<number> {
    return this.events.length;
  }
}
