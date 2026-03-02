"use client";

// ==========================================
// useEventStream - SSE Hook for real-time events
// ==========================================

import { useEffect, useRef, useState, useCallback } from "react";
import { createEventStream } from "@/lib/api";

export interface SSEEvent {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  correlationId: string;
  channel: string;
  payload: Record<string, unknown>;
}

export function useEventStream() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    const es = createEventStream(
      (data) => {
        if (data.type === "CONNECTED") {
          setConnected(true);
          return;
        }

        const event: SSEEvent = {
          id: (data.id as string) || "",
          type: (data.type as string) || "",
          source: (data.source as string) || "",
          timestamp: (data.timestamp as string) || new Date().toISOString(),
          correlationId: (data.correlationId as string) || "",
          channel: (data.channel as string) || "",
          payload: (data.payload as Record<string, unknown>) || {},
        };

        setEvents((prev) => [event, ...prev].slice(0, 100)); // Keep last 100
      },
      () => {
        setConnected(false);
      },
    );

    eventSourceRef.current = es;

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  return { events, connected, clearEvents };
}
