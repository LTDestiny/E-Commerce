import {
  notificationsApi,
  ordersApi,
  paymentsApi,
  shipmentsApi,
  usersApi,
} from "@/lib/api";
import { appendStatusHistory } from "./status-history";
import { getAllowedTransitions, statusPolicies } from "./status-policies";
import type { AdminStatusChangeRequest, AdminStatusChangeResult } from "./status-types";

function createLocalAuditId() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") {
    return `local-audit-${webCrypto.randomUUID()}`;
  }

  if (typeof webCrypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `local-audit-${hex}`;
  }

  return `local-audit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function changeAdminStatus(request: AdminStatusChangeRequest): Promise<AdminStatusChangeResult> {
  const changedAt = new Date().toISOString();
  const allowed = getAllowedTransitions(request.entityType, request.fromStatus);
  const policy = statusPolicies[request.entityType];
  const target = policy.statuses[request.toStatus];

  if (policy.readOnly) {
    throw new Error(policy.readOnlyReason || "This status is read-only.");
  }

  if (!allowed.includes(request.toStatus)) {
    throw new Error(`Transition ${request.fromStatus} -> ${request.toStatus} is not allowed.`);
  }

  if (target?.requiresReason && !request.reason?.trim()) {
    throw new Error("Reason is required for this status change.");
  }

  try {
    if (request.entityType === "order") {
      await ordersApi.updateStatus(request.entityId, request.toStatus, request.reason);
    } else if (request.entityType === "payment") {
      await paymentsApi.updateStatus(request.entityId, {
        status: request.toStatus,
        reason: request.reason,
        transactionId: request.metadata?.transactionId as string | undefined,
      });
    } else if (request.entityType === "shipment") {
      await shipmentsApi.updateStatus(request.entityId, {
        status: request.toStatus,
        reason: request.reason,
        trackingNumber: request.metadata?.trackingNumber as string | undefined,
      });
    } else if (request.entityType === "notification") {
      await notificationsApi.updateStatus(request.entityId, {
        status: request.toStatus,
        reason: request.reason,
      });
    } else if (request.entityType === "user") {
      await usersApi.updateStatus(request.entityId, {
        status: request.toStatus,
        reason: request.reason,
      });
    } else {
      // TODO: Add a real backend endpoint if inventory lifecycle status becomes manual.
      throw new Error("This entity type does not support manual status updates.");
    }

    const result: AdminStatusChangeResult = {
      success: true,
      entityId: request.entityId,
      entityType: request.entityType,
      previousStatus: request.fromStatus,
      currentStatus: request.toStatus,
      changedAt,
      changedBy: request.actorName || request.actorEmail || request.actorId,
      auditLogId: createLocalAuditId(),
    };

    appendStatusHistory({
      id: result.auditLogId!,
      timestamp: changedAt,
      actorId: request.actorId,
      actorName: request.actorName,
      actorEmail: request.actorEmail,
      entityType: request.entityType,
      entityId: request.entityId,
      action: "STATUS_CHANGED",
      fromStatus: request.fromStatus,
      toStatus: request.toStatus,
      reason: request.reason,
      result: "SUCCESS",
      metadata: request.metadata,
    });

    return result;
  } catch (error) {
    appendStatusHistory({
      id: createLocalAuditId(),
      timestamp: changedAt,
      actorId: request.actorId,
      actorName: request.actorName,
      actorEmail: request.actorEmail,
      entityType: request.entityType,
      entityId: request.entityId,
      action: "STATUS_CHANGED",
      fromStatus: request.fromStatus,
      toStatus: request.toStatus,
      reason: request.reason,
      result: "FAILED",
      metadata: {
        ...request.metadata,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
