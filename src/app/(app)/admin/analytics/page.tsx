import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import {
  AnalyticsDashboard,
  type OrderRow,
  type PaymentRow,
  type LineRow,
} from "./_components/AnalyticsDashboard";

export default async function AnalyticsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "admin") redirect("/checkout");

  const supabase = await createClient();

  // Capped, computed-in-JS aggregation -- same pattern as the existing
  // /reports page, just a higher cap since a dashboard spans more history
  // than three rollup cards. Stops scaling if order volume gets much
  // larger; fine for now, not worth pre-optimizing.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, total, created_at, customer_name, void_reason, voided_at, converted_order_id")
    .order("created_at", { ascending: false })
    .limit(5000)
    .returns<OrderRow[]>();

  const allOrders = orders ?? [];
  const orderIds = allOrders.map((o) => o.id);

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

  return (
    <div>
      <h1 className="text-2xl font-medium text-on-surface">Analytics</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Sales, payment methods, and reports across your chosen period.
      </p>

      <div className="mt-6">
        <AnalyticsDashboard orders={allOrders} payments={payments ?? []} lines={lines ?? []} />
      </div>
    </div>
  );
}
