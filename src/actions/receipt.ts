"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/auth/staff";
import type { ReceiptData } from "@/components/Receipt";

export type ActionState = { error: string | null };
const ok: ActionState = { error: null };

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  ewallet: "E-wallet",
  bank_transfer: "Bank transfer",
};

// Rebuilds the exact same shape Receipt.tsx renders, from the order's
// stored rows -- so a historical order can be reprinted/re-emailed with the
// same numbers it actually sold for, not recomputed from current prices.
async function buildReceiptData(orderId: string): Promise<ReceiptData | null> {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, created_at, customer_name, customer_phone, subtotal, total, discount_type, discount_value, discount_amount, staff:staff_id(full_name), order_lines(sku, name, quantity, unit_price), payments(method, amount, reference_number, card_fee_amount, installment_months, installment_monthly_amount)",
    )
    .eq("id", orderId)
    .single();
  if (!order) return null;

  const staff = Array.isArray(order.staff) ? order.staff[0] : order.staff;
  const payments = order.payments ?? [];
  const paidSoFar = payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(0, Math.round((order.total - paidSoFar) * 100) / 100);

  return {
    orderId: order.id,
    createdAt: order.created_at,
    cashierName: staff?.full_name ?? "Unknown staff",
    customerName: order.customer_name ?? "",
    customerPhone: order.customer_phone ?? "",
    lines: (order.order_lines ?? []).map((l) => ({
      sku: l.sku,
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unit_price,
    })),
    subtotal: order.subtotal,
    discountType: order.discount_type,
    discountValue: order.discount_value,
    discountAmount: order.discount_amount,
    total: order.total,
    tenders: payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      referenceNumber: p.reference_number ?? "",
      cardFeeAmount: p.card_fee_amount,
      installmentMonths: p.installment_months,
      installmentMonthlyAmount: p.installment_monthly_amount,
    })),
    // Reprinted/emailed after the fact -- change was already handed back
    // at the register, nothing to show here.
    change: 0,
    balanceDue,
  };
}

function renderReceiptHtml(data: ReceiptData): string {
  const receiptNumber = data.orderId.slice(0, 8).toUpperCase();
  const lineRows = data.lines
    .map(
      (l) =>
        `<tr><td style="padding:4px 0;">${l.name} (${l.sku})</td><td style="text-align:right;">${l.quantity}</td><td style="text-align:right;">₱${l.unitPrice.toFixed(2)}</td><td style="text-align:right;">₱${(l.unitPrice * l.quantity).toFixed(2)}</td></tr>`,
    )
    .join("");

  const tenderRows = data.tenders
    .map((t) => {
      let extra = "";
      if (t.referenceNumber) extra += `<div>Reference #: ${t.referenceNumber}</div>`;
      if (t.cardFeeAmount > 0) extra += `<div>Card processing fee (3%): ₱${t.cardFeeAmount.toFixed(2)}</div>`;
      if (t.installmentMonths && t.installmentMonthlyAmount) {
        extra += `<div>${t.installmentMonths} months × ₱${t.installmentMonthlyAmount.toFixed(2)}/mo</div>`;
      }
      return `<div style="margin-top:6px; font-size:13px; color:#444;"><div>Paid (${METHOD_LABELS[t.method] ?? t.method}): ₱${t.amount.toFixed(2)}</div>${extra}</div>`;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto; color:#1a1c1b;">
      <h2 style="text-align:center; margin-bottom:0;">XG Point of Sale</h2>
      <p style="text-align:center; color:#666; margin-top:4px;">Car accessories</p>
      <p style="font-size:12px; color:#666;">Receipt #${receiptNumber} &middot; ${new Date(data.createdAt).toLocaleString()}</p>
      <p style="font-size:12px; color:#666;">Cashier: ${data.cashierName}</p>
      <table style="width:100%; border-collapse:collapse; font-size:14px; margin-top:12px;">
        <thead>
          <tr style="border-bottom:1px solid #ccc; text-align:left;">
            <th style="padding:4px 0;">Item</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>
      <div style="margin-top:12px; font-size:14px;">
        <div>Subtotal: ₱${data.subtotal.toFixed(2)}</div>
        ${data.discountAmount > 0 ? `<div>Discount: -₱${data.discountAmount.toFixed(2)}</div>` : ""}
        <div style="font-weight:600;">Total: ₱${data.total.toFixed(2)}</div>
        ${tenderRows}
        ${data.balanceDue > 0 ? `<div style="color:#c02020; margin-top:6px;">Balance due: ₱${data.balanceDue.toFixed(2)}</div>` : ""}
      </div>
      <p style="text-align:center; font-size:12px; color:#666; margin-top:16px;">Thank you for your purchase!</p>
    </div>
  `;
}

export async function sendReceiptEmail(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: "You must be signed in." };

  const orderId = String(formData.get("orderId") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  if (!orderId) return { error: "Missing order id." };
  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) return { error: "Email sending isn't configured yet." };

  const data = await buildReceiptData(orderId);
  if (!data) return { error: "Order not found." };

  const receiptNumber = data.orderId.slice(0, 8).toUpperCase();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: `XG Point of Sale <${fromEmail}>`,
      to: email,
      subject: `Receipt #${receiptNumber} - XG Point of Sale`,
      html: renderReceiptHtml(data),
    }),
  });

  if (!res.ok) {
    // Resend's own error message (e.g. the sandbox "you can only send to
    // your own address" restriction) is passed through verbatim rather
    // than a generic failure, same posture as recordInventorySale.
    const body = await res.text();
    return { error: `Could not send the email: ${body}` };
  }

  return ok;
}
