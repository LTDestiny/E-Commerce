"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ChevronDown, History, Lock } from "lucide-react";
import { getStoredUser, syncClientAuthState } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getStatusHistory } from "@/lib/admin/status/status-history";
import { getAllowedTransitions, getStatusDefinition, statusPolicies } from "@/lib/admin/status/status-policies";
import { changeAdminStatus } from "@/lib/admin/status/status-service";
import type { AdminStatusEntityType, StatusHistoryEntry } from "@/lib/admin/status/status-types";

const toneClasses = {
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  green: "bg-emerald-100 text-emerald-800 border-emerald-200",
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  red: "bg-red-100 text-red-800 border-red-200",
  zinc: "bg-zinc-100 text-zinc-700 border-zinc-200",
  purple: "bg-purple-100 text-purple-800 border-purple-200",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
  orange: "bg-orange-100 text-orange-800 border-orange-200",
  slate: "bg-slate-100 text-slate-800 border-slate-200",
};

export function StatusBadge({
  entityType,
  status,
  className,
}: {
  entityType: AdminStatusEntityType;
  status: string;
  className?: string;
}) {
  const definition = getStatusDefinition(entityType, status);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.08em]", toneClasses[definition.tone], className)}>
      {definition.label}
    </span>
  );
}

export function StatusPolicyHint({
  entityType,
  status,
}: {
  entityType: AdminStatusEntityType;
  status: string;
}) {
  const policy = statusPolicies[entityType];
  const definition = getStatusDefinition(entityType, status);
  if (policy.readOnly || definition.terminal) {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-lg border border-zinc-200 bg-[#f7f5fb] p-3 text-xs text-zinc-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{policy.readOnlyReason || `${definition.label} is terminal. Manual status changes are disabled.`}</span>
      </div>
    );
  }
  return (
    <div className="mt-2 text-xs text-zinc-500">
      Allowed next: {getAllowedTransitions(entityType, status).join(", ") || "No manual transitions available"}.
    </div>
  );
}

export function StatusChangeDialog({
  entityType,
  entityId,
  entityLabel,
  currentStatus,
  targetStatus,
  open,
  onOpenChange,
  onChanged,
}: {
  entityType: AdminStatusEntityType;
  entityId: string;
  entityLabel: string;
  currentStatus: string;
  targetStatus: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const targetDefinition = targetStatus ? getStatusDefinition(entityType, targetStatus) : null;

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open, targetStatus]);

  if (!open || !targetStatus || !targetDefinition) return null;

  const confirm = async () => {
    setSaving(true);
    setError(null);
    const actor = syncClientAuthState() || getStoredUser();
    try {
      await changeAdminStatus({
        entityType,
        entityId,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        reason,
        actorId: actor?.id || "unknown-admin",
        actorName: actor?.name,
        actorEmail: actor?.email,
        metadata: { entityLabel },
      });
      await onChanged?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-300 bg-white p-6 shadow-2xl">
        <h2 className="text-2xl font-black">Change {entityType} status</h2>
        <p className="mt-1 text-sm text-zinc-600">{entityLabel}</p>

        <div className="mt-5 grid gap-3 rounded-xl bg-[#f6f4fb] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-600">From</span>
            <StatusBadge entityType={entityType} status={currentStatus} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-600">To</span>
            <StatusBadge entityType={entityType} status={targetStatus} />
          </div>
        </div>

        {targetDefinition.sensitive ? (
          <div className="mt-4 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            This is a sensitive operation. It may affect fulfillment, money movement, or customer access.
          </div>
        ) : null}

        <label className="mt-5 block">
          <span className="text-sm font-black">
            Reason {targetDefinition.requiresReason ? <span className="text-red-600">*</span> : <span className="font-medium text-zinc-500">(optional)</span>}
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 min-h-28 w-full rounded-lg border border-zinc-300 p-3 text-sm outline-none focus:border-blue-600"
            placeholder="Explain why this status change is needed..."
          />
        </label>

        {error ? <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => onOpenChange(false)} className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold" disabled={saving}>
            Cancel
          </button>
          <button onClick={confirm} className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-60" disabled={saving}>
            {saving ? "Updating..." : "Confirm change"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatusTransitionMenu({
  entityType,
  entityId,
  entityLabel,
  status,
  onChanged,
}: {
  entityType: AdminStatusEntityType;
  entityId: string;
  entityLabel: string;
  status: string;
  onChanged?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string | null>(null);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const transitions = getAllowedTransitions(entityType, status);
  const policy = statusPolicies[entityType];
  const disabled = policy.readOnly || transitions.length === 0;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const toggleMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect() || null;
    setMenuRect(rect);
    setOpen((value) => !value);
  };

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={toggleMenu}
        className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        title={disabled ? policy.readOnlyReason || "No valid transitions" : "Change status"}
      >
        Change <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && menuRect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 w-60 rounded-lg border border-zinc-300 bg-white p-2 shadow-2xl"
              style={{
                top: menuRect.bottom + 8,
                left: Math.max(12, menuRect.right - 240),
              }}
            >
              {transitions.map((next) => (
                <button
                  key={next}
                  onClick={() => {
                    setOpen(false);
                    setTargetStatus(next);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-[#f3f1fa]"
                >
                  <span>{getStatusDefinition(entityType, next).label}</span>
                  <StatusBadge entityType={entityType} status={next} className="scale-90" />
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
      <StatusChangeDialog
        entityType={entityType}
        entityId={entityId}
        entityLabel={entityLabel}
        currentStatus={status}
        targetStatus={targetStatus}
        open={Boolean(targetStatus)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setTargetStatus(null);
        }}
        onChanged={onChanged}
      />
    </div>
  );
}

export function StatusTransitionSelect(props: React.ComponentProps<typeof StatusTransitionMenu>) {
  return <StatusTransitionMenu {...props} />;
}

export function StatusHistoryTimeline({
  entityType,
  entityId,
}: {
  entityType: AdminStatusEntityType;
  entityId: string;
}) {
  const [entries, setEntries] = useState<StatusHistoryEntry[]>([]);

  useEffect(() => {
    const load = () => setEntries(getStatusHistory(entityType, entityId));
    load();
    window.addEventListener("admin-status-history-changed", load);
    return () => window.removeEventListener("admin-status-history-changed", load);
  }, [entityType, entityId]);

  return (
    <section className="rounded-xl border border-zinc-300 bg-white p-7">
      <div className="flex items-center gap-3">
        <History className="h-5 w-5 text-blue-700" />
        <h2 className="text-xl font-black">Status History</h2>
      </div>
      <div className="mt-5 space-y-4">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">No manual admin status changes recorded yet.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-zinc-200 bg-[#f8f6fc] p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge entityType={entry.entityType} status={entry.fromStatus} />
                <span>to</span>
                <StatusBadge entityType={entry.entityType} status={entry.toStatus} />
                <span className={cn("ml-auto font-bold", entry.result === "SUCCESS" ? "text-emerald-700" : "text-red-700")}>{entry.result}</span>
              </div>
              <div className="mt-2 text-zinc-600">
                {new Date(entry.timestamp).toLocaleString()} by {entry.actorName || entry.actorEmail || entry.actorId}
              </div>
              {entry.reason ? <div className="mt-2 font-medium">Reason: {entry.reason}</div> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
