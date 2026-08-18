import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

// /auth/callback and /reset-password must be reachable without a session --
// clicking an invite email link has no session yet, so that route must stay
// open before the code-exchange sets one, or the redirect to /login would
// fire first and the link would never work.
const SESSION_EXEMPT_PATHS = ["/login", "/reset-password", "/auth/callback"];

// Refreshes the Supabase auth session on every request and redirects
// unauthenticated users to /login. Cheap, request-wide gate -- role checks
// (cashier vs manager) happen in the page/action itself, not here.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isSessionExempt = SESSION_EXEMPT_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isSessionExempt) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/checkout";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: return supabaseResponse as-is (or a new response built from
  // it) so the refreshed auth cookies actually reach the browser.
  return supabaseResponse;
}
