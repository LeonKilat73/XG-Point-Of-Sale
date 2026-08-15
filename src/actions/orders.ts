"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaff } from "@/lib/auth/staff";
import { returnInventorySale, voidInventorySale } from "@/lib/inventory";
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

// Reverses one order line by quantity -- a partial return, distinct from
// voidOrder above which reverses the whole order. Same manager-PIN
// authorization as void. Unlike void, this doesn't need the admin client for
// its own write: nothing restricts a signed-in staff member from inserting
// into returns (see returns_insert RLS), since the PIN check is the real
// gate here too.
export async function refundOrder(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };

  const orderId = String(formData.get("orderId") ?? "");
  const orderLineId = String(formData.get("orderLineId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  const pin = String(formData.get("pin") ?? "");

  if (!orderId || !orderLineId) return { error: "Missing order or line id." };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Enter a valid quantity to refund." };
  if (!reason) return { error: "Enter a reason for the refund." };

  const pinOk = await verifyManagerPin(pin);
  if (!pinOk) return { error: "Invalid manager PIN." };

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("status").eq("id", orderId).single();
  if (!order) return { error: "Order not found." };
  if (order.status === "voided") return { error: "This order has been voided and can't be refunded." };

  const { data: line } = await supabase
    .from("order_lines")
    .select("item_id, quantity, unit_price")
    .eq("id", orderLineId)
    .eq("order_id", orderId)
    .single();
  if (!line) return { error: "Order line not found." };

  const { data: existingReturns } = await supabase
    .from("returns")
    .select("quantity")
    .eq("order_line_id", orderLineId);
  const alreadyReturned = (existingReturns ?? []).reduce((sum, r) => sum + r.quantity, 0);
  const remaining = line.quantity - alreadyReturned;
  if (quantity > remaining) {
    return { error: `Only ${remaining} remaining to refund on this line.` };
  }

  try {
    // orders.id doubles as the reference recordInventorySale sent as
    // externalReference at sale time -- there's no separate stored
    // reference column to look up (see submitSale in checkout.ts).
    await returnInventorySale(orderId, [{ itemId: line.item_id, quantity }], reason);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not process the return in inventory." };
  }

  const refundAmount = Math.round(line.unit_price * quantity * 100) / 100;
  const { error } = await supabase.from("returns").insert({
    order_id: orderId,
    order_line_id: orderLineId,
    quantity,
    refund_amount: refundAmount,
    reason,
    staff_id: staff.id,
  });

  if (error) {
    return { error: `Stock was reversed in inventory but failed to record locally: ${error.message}` };
  }

  revalidatePath("/orders");
  return ok;
}
