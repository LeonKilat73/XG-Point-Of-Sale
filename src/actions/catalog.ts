"use server";

import { lookupItemBySku, type InventoryItem } from "@/lib/inventory";

// Shared by checkout and quotes -- both need a live exact-SKU lookup so a
// barcode scan always gets fresh price/stock, not whatever a page-load
// catalog snapshot happened to have.
export async function lookupSku(sku: string): Promise<{ item: InventoryItem } | { error: string }> {
  const trimmed = sku.trim();
  if (!trimmed) return { error: "Enter a SKU." };

  try {
    const item = await lookupItemBySku(trimmed);
    if (!item) return { error: `No item found for SKU "${trimmed}".` };
    return { item };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Lookup failed." };
  }
}
