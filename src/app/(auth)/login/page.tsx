"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { login, signUp, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/checkout";

  const [signInState, signInAction, signInPending] = useActionState(login, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  return (
    <Card>
      <h1 className="text-xl font-medium text-slate-900">
        {mode === "sign-in" ? "Sign in" : "Create the first manager account"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">XG Point of Sale</p>

      {mode === "sign-in" ? (
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
      ) : (
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

      <button
        type="button"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        className="mt-4 text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
      >
        {mode === "sign-in"
          ? "First time setting this up? Create the manager account"
          : "Already have an account? Sign in"}
      </button>
    </Card>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-red-600">{children}</p>;
}
