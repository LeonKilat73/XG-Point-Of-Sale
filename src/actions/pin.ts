"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaff, isManagerOrAdmin } from "@/lib/auth/staff";
import { hashPin, isValidPin } from "@/lib/auth/pin";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

// A manager (or admin) sets their own PIN (row-scoped by RLS's
// staff_update_self, so this can safely go through the regular client).
// pin_hash itself is never readable by the authenticated/anon roles at all
// (see the migration) -- only ever written, and only ever verified via the
// service-role client.
export async function setPin(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };
  if (!isManagerOrAdmin(staff.role)) return { error: "Only a manager has a PIN." };

  const pin = String(formData.get("pin") ?? "");
  if (!isValidPin(pin)) return { error: "PIN must be 4-6 digits." };

  const supabase = await createClient();
  const { error } = await supabase.from("staff").update({ pin_hash: hashPin(pin) }).eq("id", staff.id);
  if (error) return { error: error.message };

  return ok;
}

// Checked against *any* active manager-or-admin's PIN, not just the
// signed-in user's own -- a cashier is the one usually triggering this
// (starting a void), a manager/admin is the one authorizing it by typing
// their PIN in.
export async function verifyManagerPin(pin: string): Promise<boolean> {
  if (!isValidPin(pin)) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("staff")
    .select("id")
    .in("role", ["manager", "admin"])
    .eq("is_active", true)
    .eq("pin_hash", hashPin(pin))
    .limit(1);

  return (data?.length ?? 0) > 0;
}
