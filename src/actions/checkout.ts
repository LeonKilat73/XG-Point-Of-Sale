"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaff } from "@/lib/auth/staff";
import { recordInventorySale } from "@/lib/inventory";
import type { CartLine } from "@/components/CartBuilder";

export type SubmitResult = { error: string } | { orderId: string; change: number };

// The order's id is decided upfront (not by the DB default) specifically so
// it can be sent to inventory as the sale's externalReference *before* this
// app's own order row exists -- inventory is asked to record the sale
// first, and only on success does the local order/lines/payment get
// written. A failed inventory call (e.g. oversold) leaves nothing behind on
// either side, rather than a local "completed" order with no matching stock
// movements.
export type PaymentMethod = "cash" | "card" | "ewallet" | "bank_transfer";

export async function submitSale(
  cart: CartLine[],
  payment: { method: PaymentMethod; amount: number; referenceNumber?: string },
  fromQuoteId?: string,
  customer?: { name?: string; phone?: string },
  allowPartialPayment?: boolean,
): Promise<SubmitResult> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };
  if (!staff.isActive) return { error: "Your account is deactivated." };

  if (cart.length === 0) return { error: "Cart is empty." };

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  if (!allowPartialPayment && payment.amount < subtotal) {
    return {
      error: `Payment of $${payment.amount.toFixed(2)} is less than the total of $${subtotal.toFixed(2)}.`,
    };
  }

  // A credit sale needs a real identity to collect the balance from later --
  // "optional" Bill-to only makes sense when the sale is paid in full today.
  if (allowPartialPayment && (!customer?.name?.trim() || !customer?.phone?.trim())) {
    return { error: "Credit sales require a customer name and mobile number." };
  }

  const referenceNumber = payment.referenceNumber?.trim() || null;
  if (payment.amount > 0 && (payment.method === "ewallet" || payment.method === "bank_transfer") && !referenceNumber) {
    return { error: "Enter the e-wallet or bank transfer reference number before completing the sale." };
  }

  const orderId = randomUUID();

  try {
    await recordInventorySale(
      cart.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
      orderId,
      `POS order ${orderId} (${staff.fullName})`,
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not record the sale in inventory." };
  }

  const supabase = await createClient();

  const { error: orderError } = await supabase.from("orders").insert({
    id: orderId,
    staff_id: staff.id,
    status: "completed",
    subtotal,
    total: subtotal,
    customer_name: customer?.name?.trim() || null,
    customer_phone: customer?.phone?.trim() || null,
  });
  if (orderError) {
    return { error: `Sale was recorded in inventory but failed to save locally: ${orderError.message}` };
  }

  const { error: linesError } = await supabase.from("order_lines").insert(
    cart.map((line) => ({
      order_id: orderId,
      item_id: line.itemId,
      sku: line.sku,
      name: line.name,
      unit_price: line.unitPrice,
      quantity: line.quantity,
      line_total: line.unitPrice * line.quantity,
    })),
  );
  if (linesError) {
    return { error: `Sale was recorded but its line items failed to save: ${linesError.message}` };
  }

  // A pure $0-down credit sale records no payment at all -- payments stays
  // empty until money actually changes hands, rather than a zero-amount row.
  if (payment.amount > 0) {
    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: orderId,
      method: payment.method,
      amount: payment.amount,
      reference_number: referenceNumber,
      staff_id: staff.id,
    });
    if (paymentError) {
      return { error: `Sale was recorded but the payment failed to save: ${paymentError.message}` };
    }
  }

  // Best-effort: the sale itself already fully succeeded above, so a
  // failure to tag the source quote shouldn't surface as an error to the
  // cashier -- worst case the quote just sits there looking un-converted.
  // Goes through the service-role client because orders_update RLS is
  // manager-only (that policy exists to gate voids, not this), and a
  // cashier converting their own quote is an ordinary, non-sensitive action.
  if (fromQuoteId) {
    const admin = createAdminClient();
    await admin
      .from("orders")
      .update({ converted_order_id: orderId })
      .eq("id", fromQuoteId)
      .eq("status", "quote");
  }

  revalidatePath("/checkout");
  revalidatePath("/quotes");
  const change = payment.method === "cash" && payment.amount > subtotal ? payment.amount - subtotal : 0;
  return { orderId, change };
}
