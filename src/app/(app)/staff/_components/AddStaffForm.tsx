"use client";

import { useActionState, useEffect, useRef } from "react";
import { addStaffMember, type ActionState } from "@/actions/staff";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

const initialState: ActionState = { error: null };
const selectClass =
  "w-full rounded-md border border-outline bg-surface px-3.5 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

export function AddStaffForm({ viewerIsAdmin }: { viewerIsAdmin: boolean }) {
  const [state, formAction, pending] = useActionState(addStaffMember, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      formRef.current?.reset();
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
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add staff member"}
      </Button>
    </form>
  );
}
