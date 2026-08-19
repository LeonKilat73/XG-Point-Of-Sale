import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import {
  AnalyticsDashboard,
  type OrderRow,
  type PaymentRow,
  type LineRow,
  type ReturnRow,
  type WarrantyReplacementRow,
} from "./_components/AnalyticsDashboard";

export default async function AnalyticsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "admin") redirect("/checkout");

  const supabase = await createClient();

  // Capped, computed-in-JS aggregation -- same pattern as the existing
  // /reports page. Raised well above the old 5000 now that Analytics
  // supports picking an arbitrary past date range (not just a rolling
  // window from today), so a shop with real multi-year history doesn't
  // silently lose its oldest data to the cap. Still a cap, not unlimited --
  // `count: "exact"` lets the client warn if a selected range's start
  // predates what actually got fetched, rather than quietly showing a
  // partial/wrong chart.
  const ORDERS_CAP = 20000;
  const { data: orders, count: ordersCount } = await supabase
    .from("orders")
    .select(
      "id, status, total, created_at, customer_name, customer_phone, void_reason, voided_at, converted_order_id, discount_type, discount_value, discount_amount, discount_reason, discount_staff:discount_staff_id(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(ORDERS_CAP)
    .returns<OrderRow[]>();

  const allOrders = orders ?? [];
  const orderIds = allOrders.map((o) => o.id);
  const ordersTruncated = (ordersCount ?? 0) > ORDERS_CAP;
  const oldestFetchedOrderDate = allOrders.length > 0 ? allOrders[allOrders.length - 1].created_at : null;

  const { data: payments } =
    orderIds.length > 0
      ? await supabase
          .from("payments")
          .select("order_id, method, amount")
          .in("order_id", orderIds)
          .returns<PaymentRow[]>()
      : { data: [] as PaymentRow[] };

  const { data: lines } =
    orderIds.length > 0
      ? await supabase
          .from("order_lines")
          .select("order_id, sku, name, quantity, unit_price")
          .in("order_id", orderIds)
          .returns<LineRow[]>()
      : { data: [] as LineRow[] };

  // Independent of the orders window above -- returns have their own
  // created_at (when the refund happened, not when the original sale did),
  // same reasoning as why Voids buckets on voided_at rather than created_at.
  const { data: returns } = await supabase
    .from("returns")
    .select("order_line_id, quantity, refund_amount, reason, created_at, staff:staff_id(full_name), order_lines(sku, name)")
    .order("created_at", { ascending: false })
    .limit(10000)
    .returns<ReturnRow[]>();

  // Also independent of the orders window -- same reasoning as returns above.
  const { data: warrantyReplacements } = await supabase
    .from("warranty_replacements")
    .select("quantity, unit_price, reason, created_at, staff:staff_id(full_name), sku, name")
    .order("created_at", { ascending: false })
    .limit(10000)
    .returns<WarrantyReplacementRow[]>();

  return (
    <div>
      <h1 className="text-2xl font-medium text-on-surface">Analytics</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Sales, payment methods, and reports across your chosen period.
      </p>

      <div className="mt-6">
        <AnalyticsDashboard
          orders={allOrders}
          payments={payments ?? []}
          lines={lines ?? []}
          returns={returns ?? []}
          warrantyReplacements={warrantyReplacements ?? []}
          ordersTruncated={ordersTruncated}
          oldestFetchedOrderDate={oldestFetchedOrderDate}
        />
      </div>
    </div>
  );
}
