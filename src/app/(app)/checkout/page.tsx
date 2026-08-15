import { getCurrentStaff } from "@/lib/auth/staff";
import { fetchCatalog } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";
import type { CartLine } from "@/components/CartBuilder";
import { Checkout } from "./_components/Checkout";

type QuoteLine = { item_id: string; sku: string; name: string; quantity: number };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ fromQuote?: string }>;
}) {
  const { fromQuote } = await searchParams;

  const staff = await getCurrentStaff();
  const catalog = await fetchCatalog().catch(() => []);

  let initialCart: CartLine[] | undefined;
  let initialCustomerName: string | undefined;
  let initialCustomerPhone: string | undefined;
  let quoteNotice: string | undefined;

  if (fromQuote) {
    const supabase = await createClient();
    const { data: quote } = await supabase
      .from("orders")
      .select(
        "status, converted_order_id, customer_name, customer_phone, order_lines(item_id, sku, name, quantity)",
      )
      .eq("id", fromQuote)
      .single<{
        status: string;
        converted_order_id: string | null;
        customer_name: string | null;
        customer_phone: string | null;
        order_lines: QuoteLine[];
      }>();

    if (!quote || quote.status !== "quote" || quote.converted_order_id) {
      quoteNotice = "That quote is no longer available -- it may already be converted.";
    } else {
      // Re-price and re-check stock against the live catalog rather than
      // trusting the quote's frozen numbers -- both can drift between when
      // a quote is saved and when a customer actually comes back to buy.
      const skippedLines: string[] = [];
      initialCart = [];
      for (const line of quote.order_lines) {
        const current = catalog.find((item) => item.sku === line.sku);
        if (!current) {
          skippedLines.push(line.name);
          continue;
        }
        initialCart.push({
          itemId: current.id,
          sku: current.sku,
          name: current.name,
          unitPrice: current.unitPrice ?? 0,
          quantity: line.quantity,
          isBundle: current.isBundle,
          stock: current.stock,
        });
      }

      initialCustomerName = quote.customer_name ?? undefined;
      initialCustomerPhone = quote.customer_phone ?? undefined;

      const who = quote.customer_name ? ` for ${quote.customer_name}` : "";
      quoteNotice =
        skippedLines.length > 0
          ? `Loaded quote${who} -- prices/stock refreshed. ${skippedLines.join(", ")} no longer available and was skipped.`
          : `Loaded quote${who} -- prices and stock refreshed to current values.`;
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-medium text-on-surface">Checkout</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Look up an item, build a cart, and take payment.</p>

      <div className="mt-6">
        <Checkout
          catalog={catalog}
          cashierName={staff?.fullName ?? "Unknown"}
          initialCart={initialCart}
          initialCustomerName={initialCustomerName}
          initialCustomerPhone={initialCustomerPhone}
          fromQuoteId={initialCart ? fromQuote : undefined}
          quoteNotice={quoteNotice}
        />
      </div>
    </div>
  );
}
