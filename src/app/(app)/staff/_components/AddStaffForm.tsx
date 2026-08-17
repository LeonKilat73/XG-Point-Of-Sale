"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addStaffMember, type ActionState } from "@/actions/staff";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { ScheduleEditor } from "@/components/ScheduleEditor";

const initialState: ActionState = { error: null };
const selectClass =
  "w-full rounded-md border border-outline bg-surface px-3.5 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

export function AddStaffForm({ viewerIsAdmin }: { viewerIsAdmin: boolean }) {
  const [state, formAction, pending] = useActionState(addStaffMember, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  // Forces ScheduleEditor to remount with fresh (empty) internal state
  // after a successful add -- formRef.current.reset() only resets plain
  // uncontrolled inputs, not a controlled hidden field driven by another
  // component's own useState.
  const [scheduleResetKey, setScheduleResetKey] = useState(0);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      formRef.current?.reset();
      setScheduleResetKey((k) => k + 1);
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <TextField label="Full name" name="fullName" required />
      <TextField label="Email" name="email" type="email" required />
      <TextField label="Temporary password" name="password" type="password" minLength={8} required />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">Role</span>
        <select name="role" defaultValue="cashier" className={selectClass}>
          <option value="cashier">Cashier</option>
          <option value="manager">Manager</option>
          {viewerIsAdmin && <option value="admin">Admin</option>}
        </select>
      </label>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">
          Schedule (optional)
        </span>
        <ScheduleEditor key={scheduleResetKey} />
      </div>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add staff member"}
      </Button>
    </form>
  );
}
