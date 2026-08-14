import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QuotesList, type QuoteRow } from "./_components/QuotesList";

export default async function QuotesPage() {
  const supabase = await createClient();
  const { data: quotes } = await supabase
    .from("orders")
    .select(
      "id, subtotal, total, customer_name, created_at, converted_order_id, staff:staff_id(full_name), order_lines(sku, name, quantity, unit_price)",
    )
    .eq("status", "quote")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<QuoteRow[]>();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-on-surface">Quotes</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Estimates for customers. Nothing here affects inventory or payments until converted to a sale.
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-on-primary shadow-sm transition-colors hover:shadow-md hover:brightness-110"
        >
          + New quote
        </Link>
      </div>

      <div className="mt-6">
        <QuotesList quotes={quotes ?? []} />
      </div>
    </div>
  );
}
