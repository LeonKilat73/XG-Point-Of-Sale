"use client";

import { useRef, useState } from "react";
import { lookupSku, submitSale, type CartLine } from "@/actions/checkout";
import type { InventoryItem } from "@/lib/inventory";
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

function matchesQuery(item: InventoryItem, query: string) {
  const q = query.toLowerCase();
  return (
    item.name.toLowerCase().includes(q) ||
    item.sku.toLowerCase().includes(q) ||
    (item.category?.toLowerCase().includes(q) ?? false)
  );
}

export function Checkout({ catalog, cashierName }: { catalog: InventoryItem[]; cashierName: string }) {
  const [skuInput, setSkuInput] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const skuInputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [amount, setAmount] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const amountNumber = Number(amount) || 0;

  const query = skuInput.trim();
  const matches = query.length >= 2 ? catalog.filter((item) => matchesQuery(item, query)).slice(0, 8) : [];

  function addToCart(item: {
    id: string;
    sku: string;
    name: string;
    unitPrice: number | null;
    isBundle: boolean;
    stock: number;
  }) {
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
  }

  // Works the same whether skuInput came from typing or a keyboard-wedge
  // barcode scanner (which just types the code + Enter) -- no special
  // scanner integration needed. Exact-SKU lookup still goes through
  // inventory's API for fresh stock/price at the moment of scanning.
  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    setShowDropdown(false);
    setLookupPending(true);
    const result = await lookupSku(skuInput);
    setLookupPending(false);

    if ("error" in result) {
      setLookupError(result.error);
      return;
    }

    addToCart(result.item);
    setSkuInput("");
    skuInputRef.current?.focus();
  }

  // Picking a name/category match from the dropdown adds it straight from
  // the already-fetched catalog snapshot -- no extra round trip. Final
  // stock accuracy is still enforced by inventory when the sale is
  // submitted, so a slightly stale snapshot here can't cause an oversell.
  function handlePickMatch(item: InventoryItem) {
    addToCart(item);
    setSkuInput("");
    setShowDropdown(false);
    setLookupError(null);
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
          <h2 className="text-lg font-semibold text-slate-900">XG Point of Sale</h2>
          <p className="text-xs text-slate-500">Car accessories</p>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>Receipt #{receiptNumber}</span>
          <span>{new Date(receipt.createdAt).toLocaleString()}</span>
        </div>
        <p className="text-xs text-slate-500">Cashier: {receipt.cashierName}</p>

        <table className="mt-4 w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs text-slate-400">
            <tr>
              <th className="pb-1 font-medium">Item</th>
              <th className="pb-1 text-right font-medium">Qty</th>
              <th className="pb-1 text-right font-medium">Price</th>
              <th className="pb-1 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line) => (
              <tr key={line.sku} className="border-b border-slate-100">
                <td className="py-1.5">
                  <p className="text-slate-900">{line.name}</p>
                  <p className="font-mono text-xs text-slate-400">{line.sku}</p>
                </td>
                <td className="py-1.5 text-right">{line.quantity}</td>
                <td className="py-1.5 text-right">${line.unitPrice.toFixed(2)}</td>
                <td className="py-1.5 text-right">${(line.unitPrice * line.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>${receipt.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>${receipt.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between capitalize text-slate-600">
            <span>Paid ({receipt.method})</span>
            <span>${receipt.amountPaid.toFixed(2)}</span>
          </div>
          {receipt.method === "cash" && (
            <div className="flex justify-between text-slate-600">
              <span>Change</span>
              <span>${receipt.change.toFixed(2)}</span>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">Thank you for your purchase!</p>

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
            <div className="relative flex-1">
              <TextField
                ref={skuInputRef}
                label="Search by SKU, name, or category"
                name="sku"
                value={skuInput}
                onChange={(e) => {
                  setSkuInput(e.target.value);
                  setShowDropdown(e.target.value.trim().length >= 2);
                }}
                onFocus={() => setShowDropdown(query.length >= 2)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                autoFocus
                autoComplete="off"
              />
              {showDropdown && matches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {matches.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePickMatch(item)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {item.name}
                          {item.isBundle && " · bundle"}
                        </p>
                        <p className="font-mono text-xs text-slate-400">
                          {item.sku}
                          {item.category ? ` · ${item.category}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-slate-500">
                        <p>${(item.unitPrice ?? 0).toFixed(2)}</p>
                        <p>{item.stock} in stock</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" disabled={lookupPending}>
              {lookupPending ? "Looking up…" : "Add"}
            </Button>
          </form>
          {lookupError && <p className="mt-2 text-sm text-red-600">{lookupError}</p>}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-slate-600">Cart</h2>
          {cart.length === 0 ? (
            <p className="text-sm text-slate-400">No items yet — search or scan a SKU above.</p>
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
