import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentStaff = {
  id: string;
  email: string;
  fullName: string;
  role: "cashier" | "manager";
  isActive: boolean;
};

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
    .select("full_name, email, role, is_active")
    .eq("id", user.id)
    .single();

  if (!staff) return null;

  return {
    id: user.id,
    email: staff.email,
    fullName: staff.full_name,
    role: staff.role,
    isActive: staff.is_active,
  };
});

export async function requireManager(): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("You must be signed in to do that.");
  if (staff.role !== "manager") throw new Error("Only a manager can do that.");
  return staff;
}
