"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login, signUp, requestPasswordReset, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

const initialState: AuthActionState = { error: null };

export function LoginForm({ allowSignUp }: { allowSignUp: boolean }) {
  return (
    <Suspense>
      <LoginFormInner allowSignUp={allowSignUp} />
    </Suspense>
  );
}

function LoginFormInner({ allowSignUp }: { allowSignUp: boolean }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot-password">("sign-in");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/checkout";

  const [signInState, signInAction, signInPending] = useActionState(login, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);
  const [forgotState, forgotAction, forgotPending] = useActionState(requestPasswordReset, initialState);

  const titles = {
    "sign-in": "Sign in",
    "sign-up": "Create the first manager account",
    "forgot-password": "Reset your password",
  };

  return (
    <Card>
      <h1 className="text-xl font-medium text-on-surface">{titles[mode]}</h1>
      <p className="mt-1 text-sm text-on-surface-variant">XG Point of Sale</p>

      {mode === "sign-in" && (
        <form action={signInAction} className="mt-6 space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {signInState.error && <ErrorText>{signInState.error}</ErrorText>}
          <Button type="submit" disabled={signInPending} className="w-full">
            {signInPending ? "Please wait…" : "Sign in"}
          </Button>
        </form>
      )}

      {mode === "forgot-password" && (
        <form action={forgotAction} className="mt-6 space-y-4">
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          {forgotState.error && <ErrorText>{forgotState.error}</ErrorText>}
          {forgotState.info && <p className="text-sm text-tertiary">{forgotState.info}</p>}
          <Button type="submit" disabled={forgotPending} className="w-full">
            {forgotPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      {mode === "sign-up" && allowSignUp && (
        <form action={signUpAction} className="mt-6 space-y-4">
          <TextField label="Full name" name="fullName" type="text" autoComplete="name" required />
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          {signUpState.error && <ErrorText>{signUpState.error}</ErrorText>}
          <Button type="submit" disabled={signUpPending} className="w-full">
            {signUpPending ? "Please wait…" : "Create account"}
          </Button>
        </form>
      )}

      <div className="mt-4 flex flex-col items-start gap-2">
        {mode === "sign-in" && (
          <button
            type="button"
            onClick={() => setMode("forgot-password")}
            className="text-sm text-on-surface-variant underline underline-offset-2 hover:text-on-surface"
          >
            Forgot password?
          </button>
        )}
        {mode === "forgot-password" && (
          <button
            type="button"
            onClick={() => setMode("sign-in")}
            className="text-sm text-on-surface-variant underline underline-offset-2 hover:text-on-surface"
          >
            Back to sign in
          </button>
        )}
        {mode === "sign-up" && (
          <button
            type="button"
            onClick={() => setMode("sign-in")}
            className="text-sm text-on-surface-variant underline underline-offset-2 hover:text-on-surface"
          >
            Already have an account? Sign in
          </button>
        )}
        {/* Self-signup only ever makes sense to bootstrap the very first
            manager account -- once one exists, the server rejects it anyway
            (see signUp in actions/auth.ts), so this entry point is hidden
            rather than showing every staff account a "create the manager
            account" link that can never work for them. */}
        {mode === "sign-in" && allowSignUp && (
          <button
            type="button"
            onClick={() => setMode("sign-up")}
            className="text-sm text-on-surface-variant underline underline-offset-2 hover:text-on-surface"
          >
            First time setting this up? Create the manager account
          </button>
        )}
      </div>
    </Card>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-error">{children}</p>;
}
