"use client";

import type { StatusHistoryEntry } from "./status-types";

const HISTORY_KEY = "techsphere_admin_status_history";

export function getStatusHistory(entityType?: string, entityId?: string) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const entries = raw ? (JSON.parse(raw) as StatusHistoryEntry[]) : [];
    return entries.filter((entry) => {
      if (entityType && entry.entityType !== entityType) return false;
      if (entityId && entry.entityId !== entityId) return false;
      return true;
    });
  } catch {
    return [];
  }
}

export function appendStatusHistory(entry: StatusHistoryEntry) {
  if (typeof window === "undefined") return;

  const entries = getStatusHistory();
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...entries].slice(0, 500)));
  window.dispatchEvent(new Event("admin-status-history-changed"));
}
