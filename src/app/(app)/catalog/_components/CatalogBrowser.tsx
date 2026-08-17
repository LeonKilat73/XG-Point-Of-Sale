"use client";

import { useState } from "react";
import type { InventoryItem } from "@/lib/inventory";
import { matchesQuery } from "@/lib/catalogSearch";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

export function CatalogBrowser({ catalog }: { catalog: InventoryItem[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const q = query.trim();
  const filtered = (q ? catalog.filter((item) => matchesQuery(item, q)) : catalog)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <Card>
        <TextField
          label="Search by name, SKU, or category"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </Card>

      <Card className="overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No items match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-on-surface-variant">
              <tr>
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 text-right font-medium">Price</th>
                <th className="pb-2 text-right font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
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
                    <td className="py-2 text-right text-on-surface">${(item.unitPrice ?? 0).toFixed(2)}</td>
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
        )}
      </Card>
    </div>
  );
}
