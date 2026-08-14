"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/auth/staff";
import { lookupItemBySku, recordInventorySale, type InventoryItem } from "@/lib/inventory";

export async function lookupSku(sku: string): Promise<{ item: InventoryItem } | { error: string }> {
  const trimmed = sku.trim();
  if (!trimmed) return { error: "Enter a SKU." };

  try {
    const item = await lookupItemBySku(trimmed);
    if (!item) return { error: `No item found for SKU "${trimmed}".` };
    return { item };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Lookup failed." };
  }
}

export type CartLine = {
  itemId: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  isBundle: boolean;
  stock: number;
};

export type SubmitResult = { error: string } | { orderId: string; change: number };

// The order's id is decided upfront (not by the DB default) specifically so
// it can be sent to inventory as the sale's externalReference *before* this
// app's own order row exists -- inventory is asked to record the sale
// first, and only on success does the local order/lines/payment get
// written. A failed inventory call (e.g. oversold) leaves nothing behind on
// either side, rather than a local "completed" order with no matching stock
// movements.
export async function submitSale(
  cart: CartLine[],
  payment: { method: "cash" | "card"; amount: number },
): Promise<SubmitResult> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };
  if (!staff.isActive) return { error: "Your account is deactivated." };

  if (cart.length === 0) return { error: "Cart is empty." };

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  if (payment.amount < subtotal) {
    return {
      error: `Payment of $${payment.amount.toFixed(2)} is less than the total of $${subtotal.toFixed(2)}.`,
    };
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

  const { error: paymentError } = await supabase.from("payments").insert({
    order_id: orderId,
    method: payment.method,
    amount: payment.amount,
  });
  if (paymentError) {
    return { error: `Sale was recorded but the payment failed to save: ${paymentError.message}` };
  }

  revalidatePath("/checkout");
  const change = payment.method === "cash" ? payment.amount - subtotal : 0;
  return { orderId, change };
}
