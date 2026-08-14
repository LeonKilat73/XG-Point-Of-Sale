"use client";

import { useActionState } from "react";
import { setPin, type ActionState } from "@/actions/pin";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

const initialState: ActionState = { error: null };

export function PinForm() {
  const [state, formAction, pending] = useActionState(setPin, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <TextField
        label="New PIN (4-6 digits)"
        name="pin"
        type="password"
        inputMode="numeric"
        pattern="\d{4,6}"
        required
      />
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save PIN"}
      </Button>
    </form>
  );
}
