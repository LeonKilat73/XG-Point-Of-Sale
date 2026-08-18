"use client";

import { useActionState, useState } from "react";
import { deleteStaffMember, setStaffActive, setStaffRole, updateStaffSchedule, type ActionState } from "@/actions/staff";
import { Button } from "@/components/ui/Button";
import { ScheduleEditor } from "@/components/ScheduleEditor";
import { DAY_KEYS, DAY_LABELS, type WeekSchedule } from "@/lib/schedule";

export type StaffRow = {
  id: string;
  full_name: string;
  email: string;
  role: "cashier" | "manager" | "admin";
  is_active: boolean;
  schedule: WeekSchedule | null;
};

function scheduleSummary(schedule: WeekSchedule | null): string {
  if (!schedule) return "No schedule set";
  const parts = DAY_KEYS.filter((d) => schedule[d]).map((d) => `${DAY_LABELS[d].slice(0, 3)} ${schedule[d]!.start}–${schedule[d]!.end}`);
  return parts.length ? parts.join(", ") : "No schedule set";
}

const initialState: ActionState = { error: null };

function StaffRowItem({
  row,
  isSelf,
  viewerIsAdmin,
  scheduleOpen,
  onToggleSchedule,
}: {
  row: StaffRow;
  isSelf: boolean;
  viewerIsAdmin: boolean;
  scheduleOpen: boolean;
  onToggleSchedule: () => void;
}) {
  const [activeState, activeAction, activePending] = useActionState(setStaffActive, initialState);
  const [roleState, roleAction, rolePending] = useActionState(setStaffRole, initialState);
  const [scheduleState, scheduleAction, schedulePending] = useActionState(updateStaffSchedule, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteStaffMember, initialState);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // A plain manager can freely manage cashiers/managers, but only an admin
  // can promote someone to admin or change/deactivate an existing admin --
  // matches the restriction already enforced server-side in staff.ts.
  const canManage = !isSelf && (row.role !== "admin" || viewerIsAdmin);

  return (
    <>
      <tr className="border-t border-outline-variant/60">
        <td className="px-4 py-3">
          <p className="text-on-surface">{row.full_name}</p>
          <p className="text-xs text-on-surface-variant">{row.email}</p>
          <button
            type="button"
            onClick={onToggleSchedule}
            className="mt-1 text-xs text-on-surface-variant underline underline-offset-2"
          >
            {scheduleOpen ? "Hide schedule" : scheduleSummary(row.schedule)}
          </button>
        </td>
        <td className="px-4 py-3">
          {canManage ? (
            <form action={roleAction} className="flex items-center gap-2">
              <input type="hidden" name="staffId" value={row.id} />
              <select
                name="role"
                defaultValue={row.role}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="rounded-lg border border-outline bg-surface px-2 py-1 text-sm text-on-surface"
              >
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                {viewerIsAdmin && <option value="admin">Admin</option>}
              </select>
              {rolePending && <span className="text-xs text-on-surface-variant">Saving…</span>}
            </form>
          ) : (
            <span className="capitalize text-on-surface-variant">{row.role}</span>
          )}
          {roleState.error && <p className="mt-1 text-xs text-error">{roleState.error}</p>}
        </td>
        <td className="px-4 py-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              row.is_active
                ? "bg-primary-container text-on-primary-container"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {row.is_active ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {isSelf ? (
            <span className="text-xs text-on-surface-variant">You</span>
          ) : canManage ? (
            <div className="flex flex-col items-end gap-2">
              <form action={activeAction}>
                <input type="hidden" name="staffId" value={row.id} />
                <input type="hidden" name="active" value={(!row.is_active).toString()} />
                <Button type="submit" variant="secondary" disabled={activePending} className="px-3 py-1.5 text-xs">
                  {activePending ? "…" : row.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </form>

              {confirmDelete ? (
                <div className="w-48 space-y-2 rounded-lg border border-error/40 bg-error-container/30 p-3 text-left">
                  <p className="text-xs text-on-surface">
                    Permanently delete <strong>{row.full_name}</strong>&apos;s account?
                  </p>
                  <div className="flex items-center gap-2">
                    <form action={deleteAction}>
                      <input type="hidden" name="staffId" value={row.id} />
                      <Button type="submit" variant="danger" disabled={deletePending} className="px-3 py-1.5 text-xs">
                        {deletePending ? "Deleting…" : "Yes, delete"}
                      </Button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deletePending}
                      className="text-xs text-on-surface-variant underline underline-offset-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-error underline underline-offset-2"
                >
                  Delete account
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-on-surface-variant">Admin-managed</span>
          )}
          {activeState.error && <p className="mt-1 text-xs text-error">{activeState.error}</p>}
          {deleteState.error && <p className="mt-1 text-xs text-error">{deleteState.error}</p>}
        </td>
      </tr>
      {scheduleOpen && (
        <tr className="border-t border-outline-variant/60 bg-surface-container-high">
          <td colSpan={4} className="px-4 py-4">
            <form action={scheduleAction} className="space-y-3">
              <input type="hidden" name="staffId" value={row.id} />
              <ScheduleEditor defaultSchedule={row.schedule} />
              {scheduleState.error && <p className="text-sm text-error">{scheduleState.error}</p>}
              <Button type="submit" disabled={schedulePending} className="px-3 py-1.5 text-xs">
                {schedulePending ? "Saving…" : "Save schedule"}
              </Button>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

export function StaffList({
  staff,
  currentStaffId,
  viewerIsAdmin,
}: {
  staff: StaffRow[];
  currentStaffId: string;
  viewerIsAdmin: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (staff.length === 0) {
    return <p className="text-sm text-on-surface-variant">No staff yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-outline-variant/60 bg-surface-container-low">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-on-surface-variant">
          <tr>
            <th className="px-4 pt-4 pb-2 font-medium">Name</th>
            <th className="px-4 pt-4 pb-2 font-medium">Role</th>
            <th className="px-4 pt-4 pb-2 font-medium">Status</th>
            <th className="px-4 pt-4 pb-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {staff.map((row) => (
            <StaffRowItem
              key={row.id}
              row={row}
              isSelf={row.id === currentStaffId}
              viewerIsAdmin={viewerIsAdmin}
              scheduleOpen={expandedId === row.id}
              onToggleSchedule={() => setExpandedId(expandedId === row.id ? null : row.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
