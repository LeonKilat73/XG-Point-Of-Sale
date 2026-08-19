"use client";

import type { ReactNode } from "react";
import type { PaymentMethod } from "@/actions/checkout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  ewallet: "E-wallet",
  bank_transfer: "Bank transfer",
};

export type ReceiptLine = { sku: string; name: string; quantity: number; unitPrice: number };
export type ReceiptTender = {
  method: PaymentMethod;
  amount: number;
  referenceNumber: string;
  cardFeeAmount: number;
  installmentMonths: number | null;
  installmentMonthlyAmount: number | null;
};
export type ReceiptData = {
  orderId: string;
  createdAt: string;
  cashierName: string;
  customerName: string;
  customerPhone: string;
  lines: ReceiptLine[];
  subtotal: number;
  discountType: "percent" | "flat" | null;
  discountValue: number | null;
  discountAmount: number;
  total: number;
  tenders: ReceiptTender[];
  change: number;
  balanceDue: number;
};

// Shared by Checkout (right after a sale) and Orders (reprinting/emailing
// any historical order) -- built once here so the two never drift. The
// receipt-print-area/receipt-no-print classes are handled in globals.css's
// @media print block: everything else on the page is hidden, only this
// card prints.
export function Receipt({ data, actions }: { data: ReceiptData; actions?: ReactNode }) {
  const receiptNumber = data.orderId.slice(0, 8).toUpperCase();

  return (
    <Card className="receipt-print-area mx-auto max-w-md">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-on-surface">XG Point of Sale</h2>
        <p className="text-xs text-on-surface-variant">Car accessories</p>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-on-surface-variant">
        <span>Receipt #{receiptNumber}</span>
        <span>{new Date(data.createdAt).toLocaleString()}</span>
      </div>
      <p className="text-xs text-on-surface-variant">Cashier: {data.cashierName}</p>
      {(data.customerName || data.customerPhone) && (
        <p className="text-xs text-on-surface-variant">
          Bill to: {data.customerName || "—"}
          {data.customerPhone && ` · ${data.customerPhone}`}
        </p>
      )}

      <table className="mt-4 w-full text-sm">
        <thead className="border-b border-outline-variant text-left text-xs text-on-surface-variant">
          <tr>
            <th className="pb-1 font-medium">Item</th>
            <th className="pb-1 text-right font-medium">Qty</th>
            <th className="pb-1 text-right font-medium">Price</th>
            <th className="pb-1 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={`${line.sku}-${i}`} className="border-b border-outline-variant/60">
              <td className="py-1.5">
                <p className="text-on-surface">{line.name}</p>
                <p className="font-mono text-xs text-on-surface-variant">{line.sku}</p>
              </td>
              <td className="py-1.5 text-right">{line.quantity}</td>
              <td className="py-1.5 text-right">₱{line.unitPrice.toFixed(2)}</td>
              <td className="py-1.5 text-right">₱{(line.unitPrice * line.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between text-on-surface-variant">
          <span>Subtotal</span>
          <span>₱{data.subtotal.toFixed(2)}</span>
        </div>
        {data.discountAmount > 0 && (
          <div className="flex justify-between text-on-surface-variant">
            <span>Discount {data.discountType === "percent" ? `(${data.discountValue}%)` : "(flat)"}</span>
            <span>-₱{data.discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold text-on-surface">
          <span>Total</span>
          <span>₱{data.total.toFixed(2)}</span>
        </div>
        {data.tenders.map((t, i) => (
          <div key={i} className="border-t border-outline-variant/60 pt-1">
            <div className="flex justify-between text-on-surface-variant">
              <span>Paid ({METHOD_LABELS[t.method]})</span>
              <span>₱{t.amount.toFixed(2)}</span>
            </div>
            {t.referenceNumber && (
              <div className="flex justify-between text-xs text-on-surface-variant">
                <span>Reference #</span>
                <span className="font-mono">{t.referenceNumber}</span>
              </div>
            )}
            {t.cardFeeAmount > 0 && (
              <div className="flex justify-between text-xs text-on-surface-variant">
                <span>Card processing fee (3%)</span>
                <span>₱{t.cardFeeAmount.toFixed(2)}</span>
              </div>
            )}
            {t.installmentMonths && t.installmentMonthlyAmount && (
              <p className="text-xs text-on-surface-variant">
                {t.installmentMonths} months × ₱{t.installmentMonthlyAmount.toFixed(2)}/mo
              </p>
            )}
          </div>
        ))}
        {data.change > 0 && (
          <div className="flex justify-between text-on-surface-variant">
            <span>Change</span>
            <span>₱{data.change.toFixed(2)}</span>
          </div>
        )}
        {data.balanceDue > 0 && (
          <div className="flex justify-between font-medium text-error">
            <span>Balance due</span>
            <span>₱{data.balanceDue.toFixed(2)}</span>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-on-surface-variant">Thank you for your purchase!</p>

      <div className="receipt-no-print mt-6 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => window.print()}>
          Print
        </Button>
        {actions}
      </div>
    </Card>
  );
}
