"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveQuote } from "@/actions/quotes";
import type { InventoryItem } from "@/lib/inventory";
import { CartBuilder, type CartLine } from "@/components/CartBuilder";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

type SavedQuote = {
  quoteId: string;
  customerName: string;
  customerPhone: string;
  lines: CartLine[];
  subtotal: number;
};

export function NewQuote({ catalog }: { catalog: InventoryItem[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedQuote | null>(null);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  async function handleSave() {
    setError(null);
    setSaving(true);
    const result = await saveQuote(cart, customerName, customerPhone);
    setSaving(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSaved({
      quoteId: result.quoteId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      lines: cart,
      subtotal,
    });
  }

  if (saved) {
    const quoteNumber = saved.quoteId.slice(0, 8).toUpperCase();
    return (
      <Card className="mx-auto max-w-md">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-on-surface">XG Point of Sale</h2>
          <p className="text-xs text-on-surface-variant">Estimate</p>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-on-surface-variant">
          <span>Quote #{quoteNumber}</span>
          <span>{new Date().toLocaleString()}</span>
        </div>
        {(saved.customerName || saved.customerPhone) && (
          <p className="text-xs text-on-surface-variant">
            For: {saved.customerName || "—"}
            {saved.customerPhone && ` · ${saved.customerPhone}`}
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
            {saved.lines.map((line) => (
              <tr key={line.itemId} className="border-b border-outline-variant/60">
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

        <div className="mt-3 flex justify-between text-base font-semibold text-on-surface">
          <span>Estimated total</span>
          <span>${saved.subtotal.toFixed(2)}</span>
        </div>

        <p className="mt-4 text-center text-xs text-on-surface-variant">
          Prices and availability are estimates and will be reconfirmed if this becomes a sale.
        </p>

        <Button className="mt-6 w-full" onClick={() => router.push("/quotes")}>
          Back to quotes
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
            <span>Estimated total</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <Button className="w-full" disabled={cart.length === 0 || saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save quote"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
