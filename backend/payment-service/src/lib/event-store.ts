// ==========================================
// Prisma-backed Event Store - Payment Service
// ==========================================

import { PrismaClient } from "@prisma/client";
import { DomainEvent, IEventStore, StoredEvent } from "@ecommerce/shared";
import { EventRow } from "../types";

export class PrismaEventStore implements IEventStore {
  constructor(private db: PrismaClient) {}

  async append(event: DomainEvent): Promise<void> {
    await this.db.event.create({
      data: {
        eventId: event.id,
        type: event.type,
        source: event.source,
        correlationId: event.correlationId,
        payload: event.payload as object,
        timestamp: new Date(event.timestamp),
      },
    });
    console.log(
      `[EventStore] Event stored: ${event.type} (${event.correlationId})`,
    );
  }

  async getEvents(correlationId: string): Promise<StoredEvent[]> {
    const rows = await this.db.event.findMany({
      where: { correlationId },
      orderBy: { id: "asc" },
    });
    return rows.map(this.toStoredEvent);
  }

  async getEventsByType(eventType: string): Promise<StoredEvent[]> {
    const rows = await this.db.event.findMany({
      where: { type: eventType },
      orderBy: { id: "asc" },
    });
    return rows.map(this.toStoredEvent);
  }

  async getAllEvents(limit = 100, offset = 0): Promise<StoredEvent[]> {
    const rows = await this.db.event.findMany({
      orderBy: { id: "asc" },
      skip: offset,
      take: limit,
    });
    return rows.map(this.toStoredEvent);
  }

  async getEventCount(): Promise<number> {
    return this.db.event.count();
  }

  private toStoredEvent(row: EventRow): StoredEvent {
    return {
      sequenceNumber: row.id,
      event: {
        id: row.eventId,
        type: row.type,
        source: row.source,
        correlationId: row.correlationId,
        timestamp: row.timestamp.toISOString(),
        payload: row.payload as Record<string, unknown>,
      } as DomainEvent,
      storedAt: row.storedAt.toISOString(),
    };
  }
}
