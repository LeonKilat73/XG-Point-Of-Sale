import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { WeekSchedule } from "@/lib/schedule";

export type StaffRole = "cashier" | "manager" | "admin";

export type CurrentStaff = {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  schedule: WeekSchedule | null;
};

export function isManagerOrAdmin(role: StaffRole): boolean {
  return role === "manager" || role === "admin";
}

// Cached per request (React's cache()) so multiple components/actions in the
// same render/request share one lookup instead of hitting the DB repeatedly.
export const getCurrentStaff = cache(async (): Promise<CurrentStaff | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("full_name, email, role, is_active, schedule")
    .eq("id", user.id)
    .single();

  if (!staff) return null;

  return {
    id: user.id,
    email: staff.email,
    fullName: staff.full_name,
    role: staff.role,
    isActive: staff.is_active,
    schedule: staff.schedule ?? null,
  };
});

export async function requireManager(): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("You must be signed in to do that.");
  if (!isManagerOrAdmin(staff.role)) throw new Error("Only a manager can do that.");
  return staff;
}
