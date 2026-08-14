"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaff } from "@/lib/auth/staff";
import type { CartLine } from "@/components/CartBuilder";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

export type SaveQuoteResult = { error: string } | { quoteId: string };

// A quote is just a saved cart snapshot -- no inventory call (nothing is
// reserved or decremented) and no payment row, unlike submitSale. It only
// becomes a real sale if/when a cashier opens it via
// /checkout?fromQuote=<id> and completes it normally.
export async function saveQuote(cart: CartLine[], customerName: string): Promise<SaveQuoteResult> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };
  if (!staff.isActive) return { error: "Your account is deactivated." };
  if (cart.length === 0) return { error: "Add at least one item to the quote." };

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const quoteId = randomUUID();

  const supabase = await createClient();

  const { error: orderError } = await supabase.from("orders").insert({
    id: quoteId,
    staff_id: staff.id,
    status: "quote",
    subtotal,
    total: subtotal,
    customer_name: customerName.trim() || null,
  });
  if (orderError) return { error: orderError.message };

  const { error: linesError } = await supabase.from("order_lines").insert(
    cart.map((line) => ({
      order_id: quoteId,
      item_id: line.itemId,
      sku: line.sku,
      name: line.name,
      unit_price: line.unitPrice,
      quantity: line.quantity,
      line_total: line.unitPrice * line.quantity,
    })),
  );
  if (linesError) return { error: linesError.message };

  revalidatePath("/quotes");
  return { quoteId };
}

// Quotes never touched inventory or took a payment, so discarding one is
// a plain delete (order_lines cascade) rather than needing a void-style
// reversal. Uses the service-role client since there's no cashier-level
// delete RLS policy on orders (only the manager "manage" policy covers
// delete) -- discarding your own unconverted quote isn't sensitive enough
// to need manager involvement.
export async function discardQuote(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };

  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return { error: "Missing quote id." };

  const admin = createAdminClient();
  const { data: quote } = await admin
    .from("orders")
    .select("status, converted_order_id")
    .eq("id", quoteId)
    .single();
  if (!quote) return { error: "Quote not found." };
  if (quote.status !== "quote") return { error: "This is not a quote." };
  if (quote.converted_order_id) return { error: "This quote was already converted to a sale." };

  const { error } = await admin.from("orders").delete().eq("id", quoteId);
  if (error) return { error: error.message };

  revalidatePath("/quotes");
  return ok;
}
