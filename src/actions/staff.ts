"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaff } from "@/lib/auth/staff";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addStaffMember(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };
  if (staff.role !== "manager") return { error: "Only a manager can add staff." };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "cashier");

  if (!fullName || !email || !password) return { error: "Name, email, and password are required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (role !== "cashier" && role !== "manager") return { error: "Invalid role." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, requested_role: role },
  });
  if (error) return { error: error.message };

  revalidatePath("/staff");
  return ok;
}

export async function setStaffActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };
  if (staff.role !== "manager") return { error: "Only a manager can do that." };

  const staffId = String(formData.get("staffId") ?? "");
  const active = formData.get("active") === "true";
  if (!staffId) return { error: "Missing staff id." };
  if (staffId === staff.id) return { error: "You can't deactivate your own account." };

  const admin = createAdminClient();
  const { error } = await admin.from("staff").update({ is_active: active }).eq("id", staffId);
  if (error) return { error: error.message };

  // Supabase Auth has no concept of "deactivated" -- RLS here only checks
  // auth.uid() is not null, not is_active, so without this a deactivated
  // account could still sign in directly and read staff/orders data. A ban
  // blocks it at the Auth layer instead of trying to thread is_active
  // through every RLS policy.
  await admin.auth.admin.updateUserById(staffId, { ban_duration: active ? "none" : "876000h" });

  revalidatePath("/staff");
  return ok;
}

export async function setStaffRole(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };
  if (staff.role !== "manager") return { error: "Only a manager can do that." };

  const staffId = String(formData.get("staffId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!staffId) return { error: "Missing staff id." };
  if (staffId === staff.id) return { error: "You can't change your own role." };
  if (role !== "cashier" && role !== "manager") return { error: "Invalid role." };

  const admin = createAdminClient();
  const { error } = await admin.from("staff").update({ role }).eq("id", staffId);
  if (error) return { error: error.message };

  revalidatePath("/staff");
  return ok;
}
