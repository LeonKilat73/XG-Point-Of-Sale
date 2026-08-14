"use client";

import { useState } from "react";
import { submitSale } from "@/actions/checkout";
import type { InventoryItem } from "@/lib/inventory";
import { CartBuilder, type CartLine } from "@/components/CartBuilder";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

type ReceiptLine = { sku: string; name: string; quantity: number; unitPrice: number };
type Receipt = {
  orderId: string;
  createdAt: string;
  cashierName: string;
  lines: ReceiptLine[];
  subtotal: number;
  method: "cash" | "card";
  amountPaid: number;
  change: number;
};

export function Checkout({
  catalog,
  cashierName,
  initialCart,
  fromQuoteId,
  quoteNotice,
}: {
  catalog: InventoryItem[];
  cashierName: string;
  initialCart?: CartLine[];
  fromQuoteId?: string;
  quoteNotice?: string;
}) {
  const [cart, setCart] = useState<CartLine[]>(initialCart ?? []);
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [amount, setAmount] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const amountNumber = Number(amount) || 0;

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    const result = await submitSale(cart, { method, amount: amountNumber }, fromQuoteId);
    setSubmitting(false);

    if ("error" in result) {
      setSubmitError(result.error);
      return;
    }

    setReceipt({
      orderId: result.orderId,
      createdAt: new Date().toISOString(),
      cashierName,
      lines: cart.map((line) => ({
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      subtotal,
      method,
      amountPaid: amountNumber,
      change: result.change,
    });
    setCart([]);
    setAmount("");
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
          <div className="flex justify-between capitalize text-on-surface-variant">
            <span>Paid ({receipt.method})</span>
            <span>${receipt.amountPaid.toFixed(2)}</span>
          </div>
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
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {quoteNotice && (
          <div className="rounded-lg border border-primary/30 bg-primary-container/30 px-4 py-2 text-sm text-on-surface">
            {quoteNotice}
          </div>
        )}
        <CartBuilder catalog={catalog} cart={cart} onCartChange={setCart} />
      </div>

      <Card className="h-fit space-y-4">
        <div className="flex items-center justify-between text-lg font-medium text-on-surface">
          <span>Total</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">Payment method</span>
          <div className="flex gap-2">
            {(["cash", "card"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  method === m
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <TextField
          label="Amount received"
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

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
          disabled={cart.length === 0 || submitting || amountNumber < subtotal}
          onClick={handleSubmit}
        >
          {submitting ? "Recording sale…" : "Complete sale"}
        </Button>
      </Card>
    </div>
  );
}
