import { fetchCatalog } from "@/lib/inventory";
import { CatalogBrowser } from "./_components/CatalogBrowser";

export default async function CatalogPage() {
  const catalog = await fetchCatalog().catch(() => []);

  return (
    <div>
      <h1 className="text-2xl font-medium text-on-surface">Catalog</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Browse items and check current availability.</p>

      <div className="mt-6">
        <CatalogBrowser catalog={catalog} />
      </div>
    </div>
  );
}
