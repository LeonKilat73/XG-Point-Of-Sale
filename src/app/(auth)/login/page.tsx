import { createAdminClient } from "@/lib/supabase/admin";
import { LoginForm } from "./_components/LoginForm";

// Without this, Next.js has no reason to think this page needs a per-request
// render (the staff count query doesn't touch cookies/headers/searchParams on
// its own) and will happily prerender it once at build time -- freezing "does
// an account exist yet" as whatever it was during that build, forever, which
// defeats the entire point of hiding the link after the real first manager
// signs up.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Anon can't read staff (RLS), and there's no session yet to check
  // permissions through -- service-role is the only way to answer "does any
  // account exist yet" before sign-in. Same query signUp itself already uses
  // to decide whether to actually allow the request; this just also hides
  // the entry point in the UI once it's a dead end.
  const admin = createAdminClient();
  const { count } = await admin.from("staff").select("id", { count: "exact", head: true });
  const allowSignUp = !count;

  return <LoginForm allowSignUp={allowSignUp} />;
}
