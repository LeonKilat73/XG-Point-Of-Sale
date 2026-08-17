"use client";

import { useMemo, useState } from "react";
import type { InventoryItem } from "@/lib/inventory";
import { matchesQuery } from "@/lib/catalogSearch";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

const ALL_CATEGORIES = "All";
const PAGE_SIZE = 20;

export function CatalogBrowser({ catalog }: { catalog: InventoryItem[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [page, setPage] = useState(1);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of catalog) if (item.category) set.add(item.category);
    return [ALL_CATEGORIES, ...[...set].sort()];
  }, [catalog]);

  const q = query.trim();
  const filtered = catalog
    .filter((item) => category === ALL_CATEGORIES || item.category === category)
    .filter((item) => q.length === 0 || matchesQuery(item, q))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  // A new search/category filter should always start back at page 1 --
  // adjusted during render (React's recommended pattern for this, not a
  // useEffect, which would cause an extra cascading render).
  const filterKey = `${query}|${category}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-end gap-3">
          <TextField
            label="Search by name, SKU, or category"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            className="flex-1"
          />
          {categories.length > 1 && (
            <label className="block w-48 shrink-0">
              <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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
        </div>
      </Card>

      <Card className="overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No items match.</p>
        ) : (
          <div className="max-h-[640px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-container-low text-left text-xs text-on-surface-variant">
                <tr>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 text-right font-medium">Price</th>
                  <th className="pb-2 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => {
                  const low = item.stock <= item.reorderThreshold;
                  return (
                    <tr key={item.id} className="border-t border-outline-variant/60">
                      <td className="py-2">
                        <p className="font-medium text-on-surface">
                          {item.name}
                          {item.isBundle && " · bundle"}
                        </p>
                        <p className="font-mono text-xs text-on-surface-variant">{item.sku}</p>
                        {item.description && (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                              className="mt-1 block text-xs text-on-surface-variant underline underline-offset-2"
                            >
                              {expanded === item.id ? "Hide details" : "Details"}
                            </button>
                            {expanded === item.id && (
                              <p className="mt-1 max-w-xs text-xs text-on-surface-variant">{item.description}</p>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-2 text-on-surface-variant">{item.category ?? "—"}</td>
                      <td className="py-2 text-right text-on-surface">₱{(item.unitPrice ?? 0).toFixed(2)}</td>
                      <td className="py-2 text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 ${
                            low ? "text-error" : "text-on-surface"
                          }`}
                        >
                          {item.stock}
                          {low && (
                            <span className="rounded-full bg-error-container px-1.5 py-0.5 text-xs font-medium text-on-error-container">
                              Low
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length} items
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="rounded-md border border-outline px-3 py-1.5 text-sm text-on-surface disabled:opacity-40 disabled:pointer-events-none hover:bg-surface-container-high"
              >
                Previous
              </button>
              <select
                value={safePage}
                onChange={(e) => setPage(Number(e.target.value))}
                className="rounded-md border border-outline bg-surface px-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Page {n} of {totalPages}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="rounded-md border border-outline px-3 py-1.5 text-sm text-on-surface disabled:opacity-40 disabled:pointer-events-none hover:bg-surface-container-high"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
