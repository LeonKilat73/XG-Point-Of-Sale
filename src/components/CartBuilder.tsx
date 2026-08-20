"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { lookupSku } from "@/actions/catalog";
import type { InventoryItem } from "@/lib/inventory";
import { matchesQuery } from "@/lib/catalogSearch";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

export type BundleConstituent = { itemId: string; sku: string; name: string; quantity: number };

export type CartLine = {
  itemId: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  isBundle: boolean;
  stock: number;
  // Made-to-order items -- inventory allows the sale through even at 0
  // stock, so the "only X in stock" warning below shouldn't fire for these.
  allowBackorder: boolean;
  // Only meaningful when isBundle -- what actually gets taken from stock
  // for this line, seeded from the bundle's real recipe when added to the
  // cart and freely editable from there (skip a part, swap it for a
  // different item, or add one that isn't normally in the recipe). The
  // bundle's own price never changes based on this -- only what's decremented
  // from inventory does.
  constituents?: BundleConstituent[];
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
  const [expandedBundle, setExpandedBundle] = useState<string | null>(null);
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
    allowBackorder: boolean;
    constituents?: BundleConstituent[];
  }) {
    onCartChange((prev) => {
      const existing = prev.find((line) => line.itemId === item.id);
      if (existing) {
        // Bumping the quantity of an already-customized bundle line leaves
        // its constituents alone -- re-seeding here would silently discard
        // whatever the cashier already edited.
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
          allowBackorder: item.allowBackorder,
          constituents: item.isBundle ? (item.constituents ?? []).map((c) => ({ ...c })) : undefined,
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

  function updateConstituents(itemId: string, updater: (prev: BundleConstituent[]) => BundleConstituent[]) {
    onCartChange((prev) =>
      prev.map((line) => (line.itemId === itemId ? { ...line, constituents: updater(line.constituents ?? []) } : line)),
    );
  }

  return (
    <div className="space-y-4">
      <Card>
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
          {categories.length > 1 && (
            <label className="block w-48 shrink-0">
              <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">Category</span>
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="w-full rounded-md border border-outline bg-surface px-3 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === ALL_CATEGORIES ? "All categories" : cat}
                  </option>
                ))}
              </select>
            </label>
          )}
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
                <Fragment key={line.itemId}>
                  <tr className="border-t border-outline-variant/60">
                    <td className="py-2">
                      <p className="font-medium text-on-surface">{line.name}</p>
                      <p className="font-mono text-xs text-on-surface-variant">
                        {line.sku}
                        {line.isBundle && " · bundle"}
                      </p>
                      {line.quantity > line.stock && !line.allowBackorder && (
                        <p className="text-xs text-error">Only {line.stock} in stock</p>
                      )}
                      {line.quantity > line.stock && line.allowBackorder && (
                        <p className="text-xs text-on-surface-variant">Made to order</p>
                      )}
                      {line.isBundle && (
                        <button
                          type="button"
                          onClick={() => setExpandedBundle(expandedBundle === line.itemId ? null : line.itemId)}
                          className="mt-0.5 text-xs text-primary underline underline-offset-2"
                        >
                          {expandedBundle === line.itemId
                            ? "Hide parts"
                            : `${(line.constituents ?? []).length} part(s) — edit`}
                        </button>
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
                  {line.isBundle && expandedBundle === line.itemId && (
                    <tr className="border-t border-outline-variant/60 bg-surface-container-high/40">
                      <td colSpan={5} className="py-3">
                        <BundleConstituentsEditor
                          catalog={catalog}
                          constituents={line.constituents ?? []}
                          onChange={(updater) => updateConstituents(line.itemId, updater)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// Lets a cashier edit what a bundle line actually decrements from stock --
// remove a part the customer doesn't need (built into the car already),
// swap one for a different catalog item (out of stock, sold an alternate
// instead), or add one that isn't normally in the recipe. The bundle's own
// price is untouched by any of this; see submitSale in checkout.ts for how
// this list becomes the actual stock_movements at sale time instead of the
// recipe. editingSlot tracks which row's catalog search is open: a
// constituent's array index to swap that row, "add" to append a new one,
// or null when no search is open.
function BundleConstituentsEditor({
  catalog,
  constituents,
  onChange,
}: {
  catalog: InventoryItem[];
  constituents: BundleConstituent[];
  onChange: (updater: (prev: BundleConstituent[]) => BundleConstituent[]) => void;
}) {
  const [editingSlot, setEditingSlot] = useState<number | "add" | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matches = q
    ? catalog.filter((item) => !item.isBundle && (item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q))).slice(0, 8)
    : [];

  function closeSearch() {
    setEditingSlot(null);
    setQuery("");
  }

  function pick(item: InventoryItem) {
    const picked: BundleConstituent = { itemId: item.id, sku: item.sku, name: item.name, quantity: 1 };
    if (editingSlot === "add") {
      onChange((prev) => [...prev, picked]);
    } else if (typeof editingSlot === "number") {
      const keepQuantity = constituents[editingSlot]?.quantity ?? 1;
      onChange((prev) => prev.map((c, i) => (i === editingSlot ? { ...picked, quantity: keepQuantity } : c)));
    }
    closeSearch();
  }

  function removeAt(index: number) {
    onChange((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {constituents.length === 0 ? (
        <p className="text-xs text-on-surface-variant">No parts in this bundle line.</p>
      ) : (
        <ul className="space-y-1.5">
          {constituents.map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-on-surface">
                {c.quantity} × {c.name} <span className="font-mono text-on-surface-variant">({c.sku})</span>
              </span>
              <span className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSlot(i);
                    setQuery("");
                  }}
                  className="text-primary underline underline-offset-2"
                >
                  Swap
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="text-error underline underline-offset-2"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editingSlot === null ? (
        <button
          type="button"
          onClick={() => {
            setEditingSlot("add");
            setQuery("");
          }}
          className="text-xs text-primary underline underline-offset-2"
        >
          + Add item to bundle
        </button>
      ) : (
        <div className="rounded-lg border border-outline-variant bg-surface p-2">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={editingSlot === "add" ? "Search item to add…" : "Search replacement item…"}
              className="flex-1 rounded-md border border-outline bg-surface px-2 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
            />
            <button type="button" onClick={closeSearch} className="text-xs text-on-surface-variant underline underline-offset-2">
              Cancel
            </button>
          </div>
          {matches.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pick(item)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-surface-container-high"
                >
                  <span className="truncate text-on-surface">{item.name}</span>
                  <span className="shrink-0 font-mono text-on-surface-variant">{item.sku}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
