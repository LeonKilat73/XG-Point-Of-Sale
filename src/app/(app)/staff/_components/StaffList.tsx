"use client";

import { useActionState } from "react";
import { setStaffActive, setStaffRole, type ActionState } from "@/actions/staff";
import { Button } from "@/components/ui/Button";

export type StaffRow = {
  id: string;
  full_name: string;
  email: string;
  role: "cashier" | "manager";
  is_active: boolean;
};

const initialState: ActionState = { error: null };

function StaffRowItem({ row, isSelf }: { row: StaffRow; isSelf: boolean }) {
  const [activeState, activeAction, activePending] = useActionState(setStaffActive, initialState);
  const [roleState, roleAction, rolePending] = useActionState(setStaffRole, initialState);

  return (
    <tr className="border-t border-outline-variant/60">
      <td className="px-4 py-3">
        <p className="text-on-surface">{row.full_name}</p>
        <p className="text-xs text-on-surface-variant">{row.email}</p>
      </td>
      <td className="px-4 py-3">
        {isSelf ? (
          <span className="capitalize text-on-surface-variant">{row.role}</span>
        ) : (
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
            </select>
            {rolePending && <span className="text-xs text-on-surface-variant">Saving…</span>}
          </form>
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
        ) : (
          <form action={activeAction}>
            <input type="hidden" name="staffId" value={row.id} />
            <input type="hidden" name="active" value={(!row.is_active).toString()} />
            <Button type="submit" variant="secondary" disabled={activePending} className="px-3 py-1.5 text-xs">
              {activePending ? "…" : row.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </form>
        )}
        {activeState.error && <p className="mt-1 text-xs text-error">{activeState.error}</p>}
      </td>
    </tr>
  );
}

export function StaffList({ staff, currentStaffId }: { staff: StaffRow[]; currentStaffId: string }) {
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
            <StaffRowItem key={row.id} row={row} isSelf={row.id === currentStaffId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
