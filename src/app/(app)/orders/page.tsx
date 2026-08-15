import { createClient } from "@/lib/supabase/server";
import { OrdersList, type OrderRow } from "./_components/OrdersList";

// Raised from an earlier flat 200 -- a date-filtered query is naturally
// narrower, so this mostly matters for the no-filter "recent history" view.
// Still a cap, not unlimited: if a date range genuinely has more than this
// many orders, tell OrdersList so it can say so rather than silently
// dropping rows off the end.
const ORDER_FETCH_LIMIT = 500;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, status, subtotal, total, customer_name, customer_phone, created_at, voided_at, void_reason, staff:staff_id(full_name), order_lines(id, sku, name, quantity, unit_price), payments(method, reference_number, amount), returns(order_line_id, quantity, refund_amount, reason, created_at), warranty_replacements(original_order_line_id, quantity)",
      { count: "exact" },
    )
    // Orders is real sales history -- quotes share this table (status =
    // 'quote') but live on their own /quotes page, so they're excluded here.
    .in("status", ["completed", "voided"]);

  // from/to are already full UTC instants by the time they get here --
  // OrdersList converts the user's typed local calendar day to the correct
  // UTC boundary in the browser before navigating, since the server has no
  // way to know the shop's local timezone. Do NOT reconstruct day
  // boundaries here from a plain yyyy-mm-dd string: that was tried first
  // and was wrong by the timezone offset (verified live -- a Singapore-time
  // 4:30 AM order fell outside its own calendar day's filter because it got
  // compared against UTC midnight instead of UTC+8 midnight).
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data: orders, count } = await query
    .order("created_at", { ascending: false })
    .limit(ORDER_FETCH_LIMIT)
    .returns<OrderRow[]>();

  const truncated = (count ?? 0) > ORDER_FETCH_LIMIT;

  return (
    <div>
      <h1 className="text-2xl font-medium text-on-surface">Orders</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Search past sales by receipt number, customer name, mobile number, or payment reference number -- useful
        for warranty, replacement, refund, or payment reconciliation inquiries. Voiding reverses the stock in
        inventory.
      </p>

      <div className="mt-6">
        <OrdersList
          orders={orders ?? []}
          dateFrom={from ?? ""}
          dateTo={to ?? ""}
          truncated={truncated}
          fetchLimit={ORDER_FETCH_LIMIT}
        />
      </div>
    </div>
  );
}
