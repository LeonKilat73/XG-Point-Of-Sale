"use client";

import { useRef, useState } from "react";
import { lookupSku, submitSale, type CartLine } from "@/actions/checkout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

type Receipt = { orderId: string; total: number; method: "cash" | "card"; change: number };

export function Checkout() {
  const [skuInput, setSkuInput] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const skuInputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [amount, setAmount] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const amountNumber = Number(amount) || 0;

  // Works the same whether skuInput came from typing or a keyboard-wedge
  // barcode scanner (which just types the code + Enter) -- no special
  // scanner integration needed.
  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    setLookupPending(true);
    const result = await lookupSku(skuInput);
    setLookupPending(false);

    if ("error" in result) {
      setLookupError(result.error);
      return;
    }

    const item = result.item;
    setCart((prev) => {
      const existing = prev.find((line) => line.itemId === item.id);
      if (existing) {
        return prev.map((line) =>
          line.itemId === item.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          unitPrice: item.unitPrice ?? 0,
          quantity: 1,
          isBundle: item.isBundle,
          stock: item.stock,
        },
      ];
    });
    setSkuInput("");
    skuInputRef.current?.focus();
  }

  function updateQuantity(itemId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((line) => line.itemId !== itemId));
      return;
    }
    setCart((prev) => prev.map((line) => (line.itemId === itemId ? { ...line, quantity } : line)));
  }

  function removeLine(itemId: string) {
    setCart((prev) => prev.filter((line) => line.itemId !== itemId));
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    const result = await submitSale(cart, { method, amount: amountNumber });
    setSubmitting(false);

    if ("error" in result) {
      setSubmitError(result.error);
      return;
    }

    setReceipt({ orderId: result.orderId, total: subtotal, method, change: result.change });
    setCart([]);
    setAmount("");
  }

  if (receipt) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <h2 className="text-xl font-medium text-slate-900">Sale complete</h2>
        <p className="mt-1 font-mono text-xs text-slate-400">Order {receipt.orderId}</p>
        <p className="mt-4 text-3xl font-semibold text-slate-900">${receipt.total.toFixed(2)}</p>
        <p className="mt-1 text-sm capitalize text-slate-500">{receipt.method}</p>
        {receipt.method === "cash" && (
          <p className="mt-1 text-sm text-slate-600">Change due: ${receipt.change.toFixed(2)}</p>
        )}
        <Button className="mt-6 w-full" onClick={() => setReceipt(null)}>
          Start next sale
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card>
          <form onSubmit={handleLookup} className="flex items-end gap-3">
            <TextField
              ref={skuInputRef}
              label="Scan or enter SKU"
              name="sku"
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value)}
              autoFocus
              className="flex-1"
            />
            <Button type="submit" disabled={lookupPending}>
              {lookupPending ? "Looking up…" : "Add"}
            </Button>
          </form>
          {lookupError && <p className="mt-2 text-sm text-red-600">{lookupError}</p>}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-slate-600">Cart</h2>
          {cart.length === 0 ? (
            <p className="text-sm text-slate-400">No items yet — scan or enter a SKU above.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400">
                <tr>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Price</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => (
                  <tr key={line.itemId} className="border-t border-slate-100">
                    <td className="py-2">
                      <p className="font-medium text-slate-900">{line.name}</p>
                      <p className="font-mono text-xs text-slate-400">
                        {line.sku}
                        {line.isBundle && " · bundle"}
                      </p>
                      {line.quantity > line.stock && (
                        <p className="text-xs text-red-600">Only {line.stock} in stock</p>
                      )}
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateQuantity(line.itemId, Number(e.target.value))}
                        className="w-16 rounded border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="py-2 text-right">${line.unitPrice.toFixed(2)}</td>
                    <td className="py-2 text-right">${(line.unitPrice * line.quantity).toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(line.itemId)}
                        className="text-xs text-red-600 underline underline-offset-2"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card className="h-fit space-y-4">
        <div className="flex items-center justify-between text-lg font-medium text-slate-900">
          <span>Total</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600">Payment method</span>
          <div className="flex gap-2">
            {(["cash", "card"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  method === m
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
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
          <p className="text-sm text-slate-500">
            Change:{" "}
            <span className="font-medium text-slate-900">
              ${Math.max(0, amountNumber - subtotal).toFixed(2)}
            </span>
          </p>
        )}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

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
