import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

// One per request -- create a fresh client, don't cache/reuse across requests.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // @supabase/ssr defaults to PKCE, which ties an email link to a
      // verifier cookie stored in whichever browser *requested* it -- fine
      // for OAuth (same tab, same browser, immediate redirect), but breaks
      // password reset: staff routinely request a reset on one device and
      // open the email on another (or a different browser/app entirely),
      // and PKCE has no way to validate that. This app has no OAuth sign-in
      // (email/password only), so implicit is the correct flow type
      // throughout, not just for the reset action -- it makes every email
      // link (reset, and a future signUp confirmation link if one's ever
      // sent) a self-contained token that doesn't depend on where it's
      // opened, matching how the admin-invite link already behaves.
      auth: {
        flowType: "implicit",
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component -- proxy.ts refreshes the
            // session on every request, so this can be safely ignored.
          }
        },
      },
    },
  );
}
