import { fetchCatalog } from "@/lib/inventory";
import { NewQuote } from "./_components/NewQuote";

export default async function NewQuotePage() {
  const catalog = await fetchCatalog().catch(() => []);

  return (
    <div>
      <h1 className="text-2xl font-medium text-on-surface">New quote</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Build an estimate for a customer. This doesn&apos;t reserve stock or take payment.
      </p>

      <div className="mt-6">
        <NewQuote catalog={catalog} />
      </div>
    </div>
  );
}
