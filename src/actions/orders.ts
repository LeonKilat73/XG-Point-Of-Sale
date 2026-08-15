"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaff } from "@/lib/auth/staff";
import { recordInventorySale, returnInventorySale, voidInventorySale } from "@/lib/inventory";
import { verifyManagerPin } from "./pin";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

// How many units of a line are still "just sold, untouched" -- a unit
// already refunded (money back) or already warranty-replaced (customer
// keeps a working one) is no longer available for the other operation, so
// both draw from the same pool rather than tracking independently.
async function remainingOnLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderLineId: string,
  lineQuantity: number,
): Promise<number> {
  const [{ data: returns }, { data: warranties }] = await Promise.all([
    supabase.from("returns").select("quantity").eq("order_line_id", orderLineId),
    supabase.from("warranty_replacements").select("quantity").eq("original_order_line_id", orderLineId),
  ]);
  const returned = (returns ?? []).reduce((sum, r) => sum + r.quantity, 0);
  const replaced = (warranties ?? []).reduce((sum, w) => sum + w.quantity, 0);
  return lineQuantity - returned - replaced;
}

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

  const remaining = await remainingOnLine(supabase, orderLineId, line.quantity);
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

// Swaps a defective unit for a working one -- no payment involved, distinct
// from both void and refund (nothing comes back, a replacement goes out
// instead). Draws from the same remaining-on-line pool as refundOrder (see
// remainingOnLine) so a unit can't be both refunded and warranty-replaced.
// Same manager-PIN authorization as void/refund.
export async function replaceOrder(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };

  const orderId = String(formData.get("orderId") ?? "");
  const orderLineId = String(formData.get("orderLineId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const pin = String(formData.get("pin") ?? "");

  if (!orderId || !orderLineId) return { error: "Missing order or line id." };
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: "Enter a valid quantity to replace." };
  if (!reason) return { error: "Enter a reason for the replacement." };

  const pinOk = await verifyManagerPin(pin);
  if (!pinOk) return { error: "Invalid manager PIN." };

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("status").eq("id", orderId).single();
  if (!order) return { error: "Order not found." };
  if (order.status === "voided") return { error: "This order has been voided and can't be warranty-replaced." };

  const { data: line } = await supabase
    .from("order_lines")
    .select("item_id, sku, name, quantity, unit_price")
    .eq("id", orderLineId)
    .eq("order_id", orderId)
    .single();
  if (!line) return { error: "Order line not found." };

  const remaining = await remainingOnLine(supabase, orderLineId, line.quantity);
  if (quantity > remaining) {
    return { error: `Only ${remaining} remaining to replace on this line.` };
  }

  // A fresh reference, not orderId -- reusing the original sale's reference
  // would mix this replacement's stock movement into fn_partial_return_pos_sale's
  // "already sold vs already returned" accounting for the *original* sale.
  const inventoryReference = randomUUID();

  try {
    await recordInventorySale(
      [{ itemId: line.item_id, quantity }],
      inventoryReference,
      `Warranty replacement for order ${orderId} (${staff.fullName})`,
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not record the replacement in inventory." };
  }

  const { error: insertError } = await supabase.from("warranty_replacements").insert({
    original_order_id: orderId,
    original_order_line_id: orderLineId,
    item_id: line.item_id,
    sku: line.sku,
    name: line.name,
    unit_price: line.unit_price,
    quantity,
    reason,
    customer_name: customerName || null,
    customer_phone: customerPhone || null,
    inventory_reference: inventoryReference,
    staff_id: staff.id,
  });

  if (insertError) {
    return { error: `Replacement was recorded in inventory but failed to save locally: ${insertError.message}` };
  }

  revalidatePath("/orders");
  return ok;
}

const PAYMENT_METHODS = ["cash", "card", "ewallet", "bank_transfer"] as const;

// Collects another installment toward a credit sale's balance -- no PIN
// needed (money coming in, not going out/away, same posture as the initial
// payment recorded by submitSale). Balance due is always derived from
// existing payments, never stored, so this can't overpay past what's
// actually still owed.
export async function recordPayment(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };

  const orderId = String(formData.get("orderId") ?? "");
  const method = String(formData.get("method") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const referenceNumber = String(formData.get("referenceNumber") ?? "").trim();

  if (!orderId) return { error: "Missing order id." };
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) return { error: "Invalid payment method." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a valid payment amount." };
  if ((method === "ewallet" || method === "bank_transfer") && !referenceNumber) {
    return { error: "Enter the e-wallet or bank transfer reference number." };
  }

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("status, total").eq("id", orderId).single();
  if (!order) return { error: "Order not found." };
  if (order.status === "voided") return { error: "This order has been voided." };

  const { data: existingPayments } = await supabase.from("payments").select("amount").eq("order_id", orderId);
  const alreadyPaid = (existingPayments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.round((order.total - alreadyPaid) * 100) / 100;
  if (amount > balance) {
    return { error: `Amount exceeds the balance due of $${balance.toFixed(2)}.` };
  }

  const { error } = await supabase.from("payments").insert({
    order_id: orderId,
    method,
    amount,
    reference_number: referenceNumber || null,
    staff_id: staff.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/orders");
  return ok;
}
