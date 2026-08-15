"use client";

import { useState } from "react";
import { submitSale, type PaymentMethod } from "@/actions/checkout";
import type { InventoryItem } from "@/lib/inventory";
import { CartBuilder, type CartLine } from "@/components/CartBuilder";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "ewallet", label: "E-wallet" },
  { value: "bank_transfer", label: "Bank transfer" },
];

const METHOD_LABELS: Record<PaymentMethod, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
) as Record<PaymentMethod, string>;

type ReceiptLine = { sku: string; name: string; quantity: number; unitPrice: number };
type Receipt = {
  orderId: string;
  createdAt: string;
  cashierName: string;
  customerName: string;
  customerPhone: string;
  lines: ReceiptLine[];
  subtotal: number;
  method: PaymentMethod;
  amountPaid: number;
  referenceNumber: string;
  change: number;
};

export function Checkout({
  catalog,
  cashierName,
  initialCart,
  initialCustomerName,
  initialCustomerPhone,
  fromQuoteId,
  quoteNotice,
}: {
  catalog: InventoryItem[];
  cashierName: string;
  initialCart?: CartLine[];
  initialCustomerName?: string;
  initialCustomerPhone?: string;
  fromQuoteId?: string;
  quoteNotice?: string;
}) {
  const [cart, setCart] = useState<CartLine[]>(initialCart ?? []);
  const [customerName, setCustomerName] = useState(initialCustomerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone ?? "");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  // Only cash can differ from the total (change is handed back); card,
  // e-wallet, and bank transfer are always charged/sent the exact amount.
  const amountNumber = method === "cash" ? Number(amount) || 0 : subtotal;
  const needsReference = method === "ewallet" || method === "bank_transfer";
  const referenceMissing = needsReference && referenceNumber.trim().length === 0;

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    const result = await submitSale(
      cart,
      { method, amount: amountNumber, referenceNumber: needsReference ? referenceNumber : undefined },
      fromQuoteId,
      { name: customerName, phone: customerPhone },
    );
    setSubmitting(false);

    if ("error" in result) {
      setSubmitError(result.error);
      return;
    }

    setReceipt({
      orderId: result.orderId,
      createdAt: new Date().toISOString(),
      cashierName,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      lines: cart.map((line) => ({
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      subtotal,
      method,
      amountPaid: amountNumber,
      referenceNumber: referenceNumber.trim(),
      change: result.change,
    });
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setAmount("");
    setReferenceNumber("");
  }

  if (receipt) {
    const receiptNumber = receipt.orderId.slice(0, 8).toUpperCase();
    return (
      <Card className="mx-auto max-w-md">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-on-surface">XG Point of Sale</h2>
          <p className="text-xs text-on-surface-variant">Car accessories</p>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-on-surface-variant">
          <span>Receipt #{receiptNumber}</span>
          <span>{new Date(receipt.createdAt).toLocaleString()}</span>
        </div>
        <p className="text-xs text-on-surface-variant">Cashier: {receipt.cashierName}</p>
        {(receipt.customerName || receipt.customerPhone) && (
          <p className="text-xs text-on-surface-variant">
            Bill to: {receipt.customerName || "—"}
            {receipt.customerPhone && ` · ${receipt.customerPhone}`}
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
            {receipt.lines.map((line) => (
              <tr key={line.sku} className="border-b border-outline-variant/60">
                <td className="py-1.5">
                  <p className="text-on-surface">{line.name}</p>
                  <p className="font-mono text-xs text-on-surface-variant">{line.sku}</p>
                </td>
                <td className="py-1.5 text-right">{line.quantity}</td>
                <td className="py-1.5 text-right">${line.unitPrice.toFixed(2)}</td>
                <td className="py-1.5 text-right">${(line.unitPrice * line.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between text-on-surface-variant">
            <span>Subtotal</span>
            <span>${receipt.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-on-surface">
            <span>Total</span>
            <span>${receipt.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-on-surface-variant">
            <span>Paid ({METHOD_LABELS[receipt.method]})</span>
            <span>${receipt.amountPaid.toFixed(2)}</span>
          </div>
          {receipt.referenceNumber && (
            <div className="flex justify-between text-on-surface-variant">
              <span>Reference #</span>
              <span className="font-mono">{receipt.referenceNumber}</span>
            </div>
          )}
          {receipt.method === "cash" && (
            <div className="flex justify-between text-on-surface-variant">
              <span>Change</span>
              <span>${receipt.change.toFixed(2)}</span>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-on-surface-variant">Thank you for your purchase!</p>

        <Button className="mt-6 w-full" onClick={() => setReceipt(null)}>
          Start next sale
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {quoteNotice && (
        <div className="rounded-lg border border-primary/30 bg-primary-container/30 px-4 py-2 text-sm text-on-surface">
          {quoteNotice}
        </div>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Bill to (optional)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <TextField
            label="Mobile number"
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <CartBuilder catalog={catalog} cart={cart} onCartChange={setCart} />

        <Card className="h-fit space-y-4">
          <div className="flex items-center justify-between text-lg font-medium text-on-surface">
            <span>Total</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">Payment method</span>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    method === m.value
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {method === "cash" && (
            <TextField
              label="Amount received"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}

          {needsReference && (
            <TextField
              label={`${METHOD_LABELS[method]} reference number`}
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="From the payment confirmation"
              required
            />
          )}

          {method === "card" && (
            <p className="text-sm text-on-surface-variant">
              Charge ${subtotal.toFixed(2)} on the terminal and attach the printed receipt.
            </p>
          )}

          {method === "cash" && amountNumber > 0 && (
            <p className="text-sm text-on-surface-variant">
              Change:{" "}
              <span className="font-medium text-on-surface">
                ${Math.max(0, amountNumber - subtotal).toFixed(2)}
              </span>
            </p>
          )}

          {submitError && <p className="text-sm text-error">{submitError}</p>}

          <Button
            className="w-full"
            disabled={cart.length === 0 || submitting || amountNumber < subtotal || referenceMissing}
            onClick={handleSubmit}
          >
            {submitting ? "Recording sale…" : "Complete sale"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
