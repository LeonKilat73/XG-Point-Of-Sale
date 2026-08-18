"use client";

import { useActionState } from "react";
import { setNewPassword, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

const initialState: AuthActionState = { error: null };

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(setNewPassword, initialState);

  return (
    <Card>
      <h1 className="text-xl font-medium text-on-surface">Set your password</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Choose a password to finish setting up your account.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        {state.error && <p className="text-sm text-error">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Set password"}
        </Button>
      </form>
    </Card>
  );
}
