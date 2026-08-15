"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/auth/staff";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export async function getOpenShift(): Promise<{ id: string; clock_in: string } | null> {
  const staff = await getCurrentStaff();
  if (!staff) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("shifts")
    .select("id, clock_in")
    .eq("staff_id", staff.id)
    .is("clock_out", null)
    .maybeSingle();

  return data ?? null;
}

export type ClockInResult = ActionState & { shift?: { id: string; clock_in: string } };

export async function clockIn(): Promise<ClockInResult> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };
  if (!staff.isActive) return { error: "Your account is deactivated." };

  const existing = await getOpenShift();
  if (existing) return { error: "Already clocked in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shifts")
    .insert({ staff_id: staff.id })
    .select("id, clock_in")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null, shift: data };
}

export async function clockOut(): Promise<ActionState> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };

  const existing = await getOpenShift();
  if (!existing) return { error: "Not currently clocked in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shifts")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return ok;
}
