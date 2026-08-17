"use client";

import { useMemo, useRef, useState } from "react";
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

const ALL_CATEGORIES = "All";

// Shared by Checkout (real sale) and the new-quote page (estimate, no
// inventory/payment effect) -- both need the identical "browse or scan an
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
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of catalog) if (item.category) set.add(item.category);
    return [ALL_CATEGORIES, ...[...set].sort()];
  }, [catalog]);

  const query = skuInput.trim();
  const browseList = catalog.filter(
    (item) =>
      (activeCategory === ALL_CATEGORIES || item.category === activeCategory) &&
      (query.length === 0 || matchesQuery(item, query)),
  );

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

  // Tapping a row in the browse list adds it straight from the
  // already-fetched catalog snapshot -- no extra round trip. Final stock
  // accuracy is still enforced by inventory at the moment a real sale is
  // submitted, so a slightly stale snapshot here can't cause an oversell --
  // for a quote it's advisory only anyway. Deliberately doesn't clear the
  // search/category filter, so tapping several items from the same
  // category in a row doesn't require re-filtering each time.
  function handlePickMatch(item: InventoryItem) {
    addToCart(item);
    setLookupError(null);
  }

  // Quantity edits never remove a line, even a momentary 0/empty value
  // while backspacing to retype a number -- only the explicit Remove
  // button does that. QuantityInput below withholds invalid values until
  // blur/Enter instead of committing on every keystroke.
  function updateQuantity(itemId: string, quantity: number) {
    onCartChange((prev) => prev.map((line) => (line.itemId === itemId ? { ...line, quantity } : line)));
  }

  function removeLine(itemId: string) {
    onCartChange((prev) => prev.filter((line) => line.itemId !== itemId));
  }

  return (
    <div className="space-y-4">
      <Card>
        {categories.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? "border border-primary bg-primary-container text-on-primary-container"
                    : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleLookup} className="flex items-end gap-3">
          <TextField
            ref={skuInputRef}
            label="Search by SKU, name, or category"
            name="sku"
            value={skuInput}
            onChange={(e) => setSkuInput(e.target.value)}
            autoFocus
            autoComplete="off"
            className="flex-1"
          />
          <Button type="submit" disabled={lookupPending}>
            {lookupPending ? "Looking up…" : "Add"}
          </Button>
        </form>
        {lookupError && <p className="mt-2 text-sm text-error">{lookupError}</p>}

        <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-outline-variant">
          {browseList.length === 0 ? (
            <p className="p-3 text-sm text-on-surface-variant">No items match.</p>
          ) : (
            browseList.map((item) => (
              <div key={item.id} className="border-b border-outline-variant/60 last:border-b-0">
                <button
                  type="button"
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
                    <p>₱{(item.unitPrice ?? 0).toFixed(2)}</p>
                    <p>{item.stock} in stock</p>
                  </div>
                </button>
                {item.description && (
                  <div className="px-3 pb-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedDetail(expandedDetail === item.id ? null : item.id);
                      }}
                      className="text-xs text-on-surface-variant underline underline-offset-2"
                    >
                      {expandedDetail === item.id ? "Hide details" : "Details"}
                    </button>
                    {expandedDetail === item.id && (
                      <p className="mt-1 text-xs text-on-surface-variant">{item.description}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Cart</h2>
        {cart.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No items yet — tap or search above.</p>
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
                    <QuantityInput
                      value={line.quantity}
                      onCommit={(quantity) => updateQuantity(line.itemId, quantity)}
                    />
                  </td>
                  <td className="py-2 text-right">₱{line.unitPrice.toFixed(2)}</td>
                  <td className="py-2 text-right">₱{(line.unitPrice * line.quantity).toFixed(2)}</td>
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

// Buffers the raw typed text separately from the committed cart quantity,
// so backspacing "1" to retype a number doesn't briefly commit 0/empty --
// updateQuantity only ever runs on blur/Enter with a validated positive
// integer. An invalid or empty value on blur reverts to the last committed
// quantity rather than removing the line; only the Remove button does that.
// `draft` is null while not actively editing, so the input just mirrors
// `value` directly (no effect needed to keep it in sync when the cart
// changes some other way, e.g. tapping the same item again elsewhere).
function QuantityInput({ value, onCommit }: { value: number; onCommit: (quantity: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const parsed = parseInt(draft, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed !== value) {
      onCommit(parsed);
    }
    setDraft(null);
  }

  return (
    <input
      type="number"
      min={1}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      className="w-16 rounded border border-outline bg-surface px-2 py-1 text-on-surface"
    />
  );
}
