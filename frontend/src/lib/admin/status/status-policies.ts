import type { AdminStatusEntityType, StatusDefinition, StatusPolicy } from "./status-types";

const s = (
  value: string,
  label: string,
  description: string,
  tone: StatusDefinition["tone"],
  options: Omit<StatusDefinition, "value" | "label" | "description" | "tone"> = {},
): StatusDefinition => ({ value, label, description, tone, requiresConfirm: true, ...options });

export const statusPolicies: Record<AdminStatusEntityType, StatusPolicy> = {
  order: {
    entityType: "order",
    statuses: {
      PENDING: s("PENDING", "Pending", "Order has been created and is waiting for confirmation.", "amber"),
      CONFIRMED: s("CONFIRMED", "Confirmed", "Payment is complete and the order is confirmed for fulfillment.", "blue"),
      PROCESSING: s("PROCESSING", "Processing", "Order is actively being fulfilled.", "indigo"),
      COMPLETED: s("COMPLETED", "Completed", "Order has been delivered and completed.", "green", { terminal: true }),
      CANCELLED: s("CANCELLED", "Cancelled", "Order was cancelled and is terminal.", "slate", { terminal: true, requiresReason: true, sensitive: true }),
      FAILED: s("FAILED", "Failed", "Order failed and may be retried or cancelled.", "red", { requiresReason: true }),
    },
    transitions: {
      PENDING: ["CONFIRMED", "CANCELLED", "FAILED"],
      CONFIRMED: ["PROCESSING", "CANCELLED"],
      PROCESSING: ["COMPLETED", "CANCELLED", "FAILED"],
      FAILED: ["PENDING", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    },
  },
  payment: {
    entityType: "payment",
    statuses: {
      PENDING: s("PENDING", "Pending", "Payment is waiting to be captured.", "amber"),
      COMPLETED: s("COMPLETED", "Completed", "Payment was captured.", "green"),
      FAILED: s("FAILED", "Failed", "Payment failed.", "red", { requiresReason: true }),
      CANCELLED: s("CANCELLED", "Cancelled", "Payment was cancelled.", "slate", { terminal: true, requiresReason: true }),
      REFUNDED: s("REFUNDED", "Refunded", "Money has been refunded.", "orange", { terminal: true, requiresReason: true, sensitive: true }),
    },
    transitions: {
      PENDING: ["COMPLETED", "FAILED", "CANCELLED"],
      FAILED: ["PENDING", "CANCELLED"],
      COMPLETED: ["REFUNDED"],
      CANCELLED: [],
      REFUNDED: [],
    },
  },
  shipment: {
    entityType: "shipment",
    statuses: {
      PENDING: s("PENDING", "Pending", "Shipment is pending scheduling.", "amber"),
      READY: s("READY", "Ready", "Shipment is packed and ready for carrier handoff.", "blue"),
      IN_TRANSIT: s("IN_TRANSIT", "In transit", "Shipment is in transit.", "blue"),
      DELAYED: s("DELAYED", "Delayed", "Shipment is delayed and needs monitoring.", "amber", { requiresReason: true }),
      DELIVERED: s("DELIVERED", "Delivered", "Shipment delivered.", "green", { terminal: true }),
      FAILED: s("FAILED", "Failed", "Shipment failed.", "red", { requiresReason: true }),
      CANCELLED: s("CANCELLED", "Cancelled", "Shipment cancelled.", "slate", { terminal: true, requiresReason: true }),
    },
    transitions: {
      PENDING: ["READY", "CANCELLED"],
      READY: ["IN_TRANSIT", "CANCELLED"],
      IN_TRANSIT: ["DELIVERED", "DELAYED", "FAILED"],
      DELAYED: ["IN_TRANSIT", "DELIVERED", "FAILED"],
      FAILED: ["PENDING", "CANCELLED"],
      DELIVERED: [],
      CANCELLED: [],
    },
  },
  notification: {
    entityType: "notification",
    statuses: {
      QUEUED: s("QUEUED", "Queued", "Notification is queued.", "amber"),
      PENDING: s("PENDING", "Pending", "Notification is pending send.", "amber"),
      SENT: s("SENT", "Sent", "Notification has been sent.", "green"),
      DELIVERED: s("DELIVERED", "Delivered", "Notification delivery confirmed.", "green", { terminal: true }),
      FAILED: s("FAILED", "Failed", "Notification failed.", "red", { requiresReason: true }),
      CANCELLED: s("CANCELLED", "Cancelled", "Notification cancelled.", "red", { terminal: true, requiresReason: true }),
    },
    transitions: {
      QUEUED: ["SENT", "FAILED", "CANCELLED"],
      PENDING: ["SENT", "FAILED", "CANCELLED"],
      FAILED: ["PENDING", "QUEUED", "CANCELLED"],
      SENT: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
    },
  },
  inventory: {
    entityType: "inventory",
    statuses: {
      ACTIVE: s("ACTIVE", "Active", "Stock is available.", "green"),
      LOW_STOCK: s("LOW_STOCK", "Low stock", "Available stock is at or below threshold.", "amber"),
      OUT_OF_STOCK: s("OUT_OF_STOCK", "Out of stock", "No available stock remains.", "red"),
      DISCONTINUED: s("DISCONTINUED", "Discontinued", "Product is manually discontinued.", "zinc", { terminal: true }),
    },
    transitions: {},
    readOnly: true,
    readOnlyReason: "Inventory status is computed from availableStock and lowStockThreshold. Change stock or threshold instead.",
  },
  user: {
    entityType: "user",
    statuses: {
      ACTIVE: s("ACTIVE", "Active", "Account can access the system.", "green"),
      SUSPENDED: s("SUSPENDED", "Suspended", "Account is suspended.", "amber", { requiresReason: true }),
      LOCKED: s("LOCKED", "Locked", "Account is locked.", "red", { requiresReason: true }),
    },
    transitions: {
      ACTIVE: ["SUSPENDED", "LOCKED"],
      SUSPENDED: ["ACTIVE", "LOCKED"],
      LOCKED: ["ACTIVE"],
    },
  },
  system: {
    entityType: "system",
    statuses: {
      healthy: s("healthy", "Healthy", "Service is operating normally.", "green", { requiresConfirm: false }),
      degraded: s("degraded", "Degraded", "Service has partial degradation.", "amber", { requiresConfirm: false }),
      unhealthy: s("unhealthy", "Unhealthy", "Service is unhealthy.", "red", { requiresConfirm: false }),
      down: s("down", "Down", "Service is unreachable.", "red", { requiresConfirm: false }),
    },
    transitions: {},
    readOnly: true,
    readOnlyReason: "System health is runtime telemetry. Admins can refresh, inspect logs, or acknowledge alerts, but cannot overwrite health status.",
  },
};

export function getStatusDefinition(entityType: AdminStatusEntityType, status: string) {
  const policy = statusPolicies[entityType];
  return policy.statuses[status] || policy.statuses[status.toUpperCase()] || s(status, status, "Unknown status from backend.", "zinc");
}

export function getAllowedTransitions(entityType: AdminStatusEntityType, status: string) {
  const policy = statusPolicies[entityType];
  if (policy.readOnly) return [];
  return policy.transitions[status] || policy.transitions[status.toUpperCase()] || [];
}

export function isTerminalStatus(entityType: AdminStatusEntityType, status: string) {
  return Boolean(getStatusDefinition(entityType, status).terminal);
}
