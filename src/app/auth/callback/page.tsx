"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";

// Landing point for invite emails. Supabase's admin-initiated links
// (inviteUserByEmail, called from a server action -- i.e. anything not
// kicked off by a browser holding a PKCE code_verifier cookie) come back as
// a hash-fragment token (#access_token=...&refresh_token=...), not a
// `?code=` query param. A fragment never reaches the server, so this has to
// run client-side rather than as a route handler. `?code=` is also handled,
// in case a future flow ends up using PKCE instead.
export default function AuthCallbackPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-surface-container-low px-4">
      <div className="w-full max-w-sm">
        <Suspense>
          <AuthCallback />
        </Suspense>
      </div>
    </div>
  );
}

function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = searchParams.get("next") ?? "/reset-password";
    const supabase = createClient();

    async function complete() {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashError = hashParams.get("error_description") ?? hashParams.get("error");

      if (hashError) {
        setError(hashError.replace(/\+/g, " "));
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        router.replace(next);
        return;
      }

      const code = searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        router.replace(next);
        return;
      }

      setError("This link is invalid or has expired.");
    }

    complete();
  }, [router, searchParams]);

  if (error) {
    return (
      <Card>
        <h1 className="text-xl font-medium text-on-surface">Link problem</h1>
        <p className="mt-2 text-sm text-error">{error}</p>
        <a href="/login" className="mt-4 inline-block text-sm text-primary underline underline-offset-2">
          Back to sign in
        </a>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm text-on-surface-variant">Signing you in…</p>
    </Card>
  );
}
