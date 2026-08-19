"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaff } from "@/lib/auth/staff";
import { recordInventorySale } from "@/lib/inventory";
import { verifyManagerPin } from "./pin";
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

const CARD_FEE_RATE = 0.03;

// One row is inserted per tender -- payments has allowed multiple rows per
// order since the credit-sale feature, this just exposes it at the initial
// sale too (Cash + E-wallet in one checkout, instead of two separate sales).
export type PaymentTender = {
  method: PaymentMethod;
  amount: number;
  referenceNumber?: string;
  installmentMonths?: 3 | 6 | 12;
};

export type DiscountInput = { type: "percent" | "flat"; value: number; reason: string; pin: string };

export async function submitSale(
  cart: CartLine[],
  payments: PaymentTender[],
  fromQuoteId?: string,
  customer?: { name?: string; phone?: string; email?: string },
  allowPartialPayment?: boolean,
  discount?: DiscountInput,
): Promise<SubmitResult> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };
  if (!staff.isActive) return { error: "Your account is deactivated." };

  if (cart.length === 0) return { error: "Cart is empty." };

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  let discountAmount = 0;
  if (discount) {
    if (!discount.reason.trim()) return { error: "Enter a reason for the discount." };
    if (!Number.isFinite(discount.value) || discount.value <= 0) return { error: "Enter a valid discount." };
    const pinOk = await verifyManagerPin(discount.pin);
    if (!pinOk) return { error: "Invalid manager PIN for the discount." };
    const raw = discount.type === "percent" ? subtotal * (discount.value / 100) : discount.value;
    discountAmount = Math.min(subtotal, Math.round(raw * 100) / 100);
  }
  const total = Math.round((subtotal - discountAmount) * 100) / 100;

  const totalTendered = Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
  if (!allowPartialPayment && totalTendered < total) {
    return {
      error: `Payment of ₱${totalTendered.toFixed(2)} is less than the total of ₱${total.toFixed(2)}.`,
    };
  }

  // A credit sale needs a real identity to collect the balance from later --
  // "optional" Bill-to only makes sense when the sale is paid in full today.
  if (allowPartialPayment && (!customer?.name?.trim() || !customer?.phone?.trim())) {
    return { error: "Credit sales require a customer name and mobile number." };
  }

  for (const p of payments) {
    if (p.amount > 0 && (p.method === "ewallet" || p.method === "bank_transfer") && !p.referenceNumber?.trim()) {
      return { error: "Enter the e-wallet or bank transfer reference number." };
    }
  }

  const orderId = randomUUID();

  try {
    await recordInventorySale(
      cart.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        // A bundle line always carries its as-configured parts list (even
        // when it's just an unedited copy of the recipe) -- see
        // BundleConstituentsEditor in CartBuilder.tsx. Inventory decrements
        // exactly this instead of re-deriving the bundle's own recipe.
        constituents: line.isBundle
          ? (line.constituents ?? []).map((c) => ({ itemId: c.itemId, quantity: c.quantity }))
          : undefined,
      })),
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
    total,
    discount_type: discount?.type ?? null,
    discount_value: discount?.value ?? null,
    discount_amount: discountAmount,
    discount_reason: discount?.reason.trim() || null,
    discount_staff_id: discount ? staff.id : null,
    customer_name: customer?.name?.trim() || null,
    customer_phone: customer?.phone?.trim() || null,
    customer_email: customer?.email?.trim() || null,
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
      is_bundle: line.isBundle,
      // Persisted so a later refund/warranty-replace/exchange on this line
      // can replay exactly what was actually taken from stock, instead of
      // re-deriving the bundle's recipe (wrong the moment a part was
      // skipped or swapped -- see orders.ts).
      bundle_constituents: line.isBundle ? line.constituents ?? [] : null,
    })),
  );
  if (linesError) {
    return { error: `Sale was recorded but its line items failed to save: ${linesError.message}` };
  }

  // A pure $0-down credit sale records no payment at all -- payments stays
  // empty until money actually changes hands, rather than a zero-amount row.
  const tendersToInsert = payments.filter((p) => p.amount > 0);
  if (tendersToInsert.length > 0) {
    const { error: paymentError } = await supabase.from("payments").insert(
      tendersToInsert.map((p) => {
        // Computed server-side, never trusting a client-sent fee/split --
        // both are informational only (kept out of `amount`) so
        // balance-due math never has to account for them.
        const cardFeeAmount = p.method === "card" ? Math.round(p.amount * CARD_FEE_RATE * 100) / 100 : 0;
        const installmentMonths = p.method === "card" ? p.installmentMonths ?? null : null;
        const installmentMonthlyAmount = installmentMonths
          ? Math.round((p.amount / installmentMonths) * 100) / 100
          : null;
        return {
          order_id: orderId,
          method: p.method,
          amount: p.amount,
          reference_number: p.referenceNumber?.trim() || null,
          card_fee_amount: cardFeeAmount,
          installment_months: installmentMonths,
          installment_monthly_amount: installmentMonthlyAmount,
          staff_id: staff.id,
        };
      }),
    );
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
  // Excess is only ever handed back as change when at least one tender was
  // cash -- overpaying via card/e-wallet/bank transfer isn't something this
  // app can hand change back for.
  const hasCashTender = payments.some((p) => p.method === "cash");
  const change = hasCashTender && totalTendered > total ? Math.round((totalTendered - total) * 100) / 100 : 0;
  return { orderId, change };
}

export type MySalesTodaySummary = { total: number; count: number };

// Personal-only by design (per the shop owner) -- shop-wide totals belong
// in /admin/analytics for managers/admins, not on every cashier's own
// checkout screen. fromIso/toIso are full UTC instants already converted
// from the browser's local calendar day (see Checkout.tsx) -- the server
// has no way to know the shop's timezone, same reasoning as the Orders/
// Shifts date filters.
export async function getMySalesToday(fromIso: string, toIso: string): Promise<MySalesTodaySummary> {
  const staff = await getCurrentStaff();
  if (!staff) return { total: 0, count: 0 };

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("total")
    .eq("staff_id", staff.id)
    .eq("status", "completed")
    .gte("created_at", fromIso)
    .lte("created_at", toIso);

  const orders = data ?? [];
  return { total: orders.reduce((sum, o) => sum + o.total, 0), count: orders.length };
}
