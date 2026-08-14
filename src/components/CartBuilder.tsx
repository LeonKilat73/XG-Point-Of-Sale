"use client";

import { useRef, useState } from "react";
import { lookupSku } from "@/actions/catalog";
import type { InventoryItem } from "@/lib/inventory";
import { matchesQuery } from "@/lib/catalogSearch";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

export type CartLine = {
  itemId: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  isBundle: boolean;
  stock: number;
};

// Shared by Checkout (real sale) and the new-quote page (estimate, no
// inventory/payment effect) -- both need the identical "scan/search an
// item, build a cart" surface, so it's extracted once here rather than
// kept as two copies that would drift.
export function CartBuilder({
  catalog,
  cart,
  onCartChange,
}: {
  catalog: InventoryItem[];
  cart: CartLine[];
  onCartChange: (updater: (prev: CartLine[]) => CartLine[]) => void;
}) {
  const [skuInput, setSkuInput] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const skuInputRef = useRef<HTMLInputElement>(null);

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
    onCartChange((prev) => {
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
  // stock accuracy is still enforced by inventory at the moment a real
  // sale is submitted, so a slightly stale snapshot here can't cause an
  // oversell -- for a quote it's advisory only anyway.
  function handlePickMatch(item: InventoryItem) {
    addToCart(item);
    setSkuInput("");
    setShowDropdown(false);
    setLookupError(null);
    skuInputRef.current?.focus();
  }

  function updateQuantity(itemId: string, quantity: number) {
    if (quantity <= 0) {
      onCartChange((prev) => prev.filter((line) => line.itemId !== itemId));
      return;
    }
    onCartChange((prev) => prev.map((line) => (line.itemId === itemId ? { ...line, quantity } : line)));
  }

  function removeLine(itemId: string) {
    onCartChange((prev) => prev.filter((line) => line.itemId !== itemId));
  }

  return (
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
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-lg">
                {matches.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePickMatch(item)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-container-high"
                  >
                    <div>
                      <p className="font-medium text-on-surface">
                        {item.name}
                        {item.isBundle && " · bundle"}
                      </p>
                      <p className="font-mono text-xs text-on-surface-variant">
                        {item.sku}
                        {item.category ? ` · ${item.category}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-on-surface-variant">
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
        {lookupError && <p className="mt-2 text-sm text-error">{lookupError}</p>}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Cart</h2>
        {cart.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No items yet — search or scan a SKU above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-on-surface-variant">
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
                <tr key={line.itemId} className="border-t border-outline-variant/60">
                  <td className="py-2">
                    <p className="font-medium text-on-surface">{line.name}</p>
                    <p className="font-mono text-xs text-on-surface-variant">
                      {line.sku}
                      {line.isBundle && " · bundle"}
                    </p>
                    {line.quantity > line.stock && (
                      <p className="text-xs text-error">Only {line.stock} in stock</p>
                    )}
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateQuantity(line.itemId, Number(e.target.value))}
                      className="w-16 rounded border border-outline bg-surface px-2 py-1 text-on-surface"
                    />
                  </td>
                  <td className="py-2 text-right">${line.unitPrice.toFixed(2)}</td>
                  <td className="py-2 text-right">${(line.unitPrice * line.quantity).toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(line.itemId)}
                      className="text-xs text-error underline underline-offset-2"
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
  );
}
