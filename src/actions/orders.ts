"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaff } from "@/lib/auth/staff";
import { voidInventorySale } from "@/lib/inventory";
import { verifyManagerPin } from "./pin";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

// Any signed-in staff can trigger this (a cashier is usually the one
// clicking it), but it only proceeds with a valid manager PIN -- that PIN
// check is the real authorization, which is why this writes through the
// service-role client afterward rather than the regular one: orders_update
// RLS requires the *signed-in* session to be a manager, which would wrongly
// block a cashier-initiated, manager-PIN-authorized void.
export async function voidOrder(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };

  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const pin = String(formData.get("pin") ?? "");

  if (!orderId) return { error: "Missing order id." };
  if (!reason) return { error: "Enter a reason for the void." };

  const pinOk = await verifyManagerPin(pin);
  if (!pinOk) return { error: "Invalid manager PIN." };

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("status").eq("id", orderId).single();
  if (!order) return { error: "Order not found." };
  if (order.status === "voided") return { error: "This order is already voided." };

  try {
    await voidInventorySale(orderId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not void the sale in inventory." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({
      status: "voided",
      voided_at: new Date().toISOString(),
      voided_by: staff.id,
      void_reason: reason,
    })
    .eq("id", orderId);

  if (error) {
    return { error: `Sale was reversed in inventory but failed to update locally: ${error.message}` };
  }

  revalidatePath("/orders");
  return ok;
}
