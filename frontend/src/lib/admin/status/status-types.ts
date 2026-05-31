export type AdminStatusEntityType =
  | "order"
  | "payment"
  | "shipment"
  | "notification"
  | "inventory"
  | "user"
  | "system";

export type StatusTone = "blue" | "green" | "amber" | "red" | "zinc" | "purple" | "indigo" | "orange" | "slate";

export type StatusDefinition = {
  value: string;
  label: string;
  description: string;
  tone: StatusTone;
  terminal?: boolean;
  requiresReason?: boolean;
  requiresConfirm?: boolean;
  sensitive?: boolean;
};

export type StatusPolicy = {
  entityType: AdminStatusEntityType;
  statuses: Record<string, StatusDefinition>;
  transitions: Record<string, string[]>;
  readOnly?: boolean;
  readOnlyReason?: string;
};

export type AdminStatusChangeRequest = {
  entityType: AdminStatusEntityType;
  entityId: string;
  fromStatus: string;
  toStatus: string;
  reason?: string;
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  metadata?: Record<string, unknown>;
};

export type AdminStatusChangeResult = {
  success: boolean;
  entityId: string;
  entityType: AdminStatusEntityType;
  previousStatus: string;
  currentStatus: string;
  changedAt: string;
  changedBy: string;
  auditLogId?: string;
  error?: string;
};

export type StatusHistoryEntry = {
  id: string;
  timestamp: string;
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  entityType: AdminStatusEntityType;
  entityId: string;
  action: "STATUS_CHANGED";
  fromStatus: string;
  toStatus: string;
  reason?: string;
  result: "SUCCESS" | "FAILED";
  metadata?: Record<string, unknown>;
};
