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
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3">
        <p className="text-slate-900">{row.full_name}</p>
        <p className="text-xs text-slate-400">{row.email}</p>
      </td>
      <td className="px-4 py-3">
        {isSelf ? (
          <span className="capitalize text-slate-500">{row.role}</span>
        ) : (
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="staffId" value={row.id} />
            <select
              name="role"
              defaultValue={row.role}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
            >
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </select>
            {rolePending && <span className="text-xs text-slate-400">Saving…</span>}
          </form>
        )}
        {roleState.error && <p className="mt-1 text-xs text-red-600">{roleState.error}</p>}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {row.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {isSelf ? (
          <span className="text-xs text-slate-400">You</span>
        ) : (
          <form action={activeAction}>
            <input type="hidden" name="staffId" value={row.id} />
            <input type="hidden" name="active" value={(!row.is_active).toString()} />
            <Button type="submit" variant="secondary" disabled={activePending} className="px-3 py-1.5 text-xs">
              {activePending ? "…" : row.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </form>
        )}
        {activeState.error && <p className="mt-1 text-xs text-red-600">{activeState.error}</p>}
      </td>
    </tr>
  );
}

export function StaffList({ staff, currentStaffId }: { staff: StaffRow[]; currentStaffId: string }) {
  if (staff.length === 0) {
    return <p className="text-sm text-slate-400">No staff yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-400">
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
