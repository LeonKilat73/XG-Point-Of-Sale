import "server-only";

// Thin wrapper around the inventory app's external API (see
// E:\InventorySystem\API.md) -- the only way this app ever touches stock,
// since inventory is a completely separate database.
const BASE_URL = process.env.INVENTORY_API_URL!;
const API_KEY = process.env.INVENTORY_API_KEY!;

export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unitPrice: number | null;
  unitCost: number | null;
  isBundle: boolean;
  stock: number;
  reorderThreshold: number;
  constituents?: { itemId: string; sku: string; name: string; quantity: number }[];
};

async function inventoryFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Inventory request failed (${res.status}).`);
  }
  return body;
}

export async function lookupItemBySku(sku: string): Promise<InventoryItem | null> {
  const data = await inventoryFetch(`/api/v1/items?sku=${encodeURIComponent(sku)}`);
  return data.items?.[0] ?? null;
}

// The whole active catalog in one call, for client-side name/SKU/category
// search in checkout -- inventory's catalog is small enough that fetching
// it once per checkout-page load and filtering in the browser is simpler
// and more responsive than a debounced server-side search endpoint. Stock
// shown from this snapshot is advisory only; the actual sale is still
// checked and enforced atomically by inventory at submit time.
export async function fetchCatalog(): Promise<InventoryItem[]> {
  const data = await inventoryFetch("/api/v1/items");
  return data.items ?? [];
}

export type SaleLine = { itemId: string; quantity: number };

// Atomic on inventory's side (fn_record_pos_sale) -- either every line posts
// or none do. Throws with inventory's own error message on failure (e.g. an
// oversold line), which the caller surfaces to the cashier as-is.
export async function recordInventorySale(
  lines: SaleLine[],
  externalReference: string,
  note?: string,
): Promise<{ movementIds: string[] }> {
  const data = await inventoryFetch("/api/v1/sales", {
    method: "POST",
    body: JSON.stringify({ lines, externalReference, note }),
  });
  return { movementIds: data.movementIds ?? [] };
}

// Reverses a sale recorded under the same reference (atomic on inventory's
// side too -- see fn_void_pos_sale). Throws inventory's own message on
// failure (already voided, reference not found, etc.).
export async function voidInventorySale(externalReference: string): Promise<{ movementIds: string[] }> {
  const data = await inventoryFetch(`/api/v1/sales/${externalReference}/void`, { method: "POST" });
  return { movementIds: data.movementIds ?? [] };
}
