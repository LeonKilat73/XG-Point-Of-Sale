import type { InventoryItem } from "./inventory";

export function matchesQuery(item: InventoryItem, query: string) {
  const q = query.toLowerCase();
  return (
    item.name.toLowerCase().includes(q) ||
    item.sku.toLowerCase().includes(q) ||
    (item.category?.toLowerCase().includes(q) ?? false)
  );
}
