import { createClient } from "@/lib/supabase/server";
import { OrdersList, type OrderRow } from "./_components/OrdersList";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, status, subtotal, total, created_at, voided_at, void_reason, staff:staff_id(full_name), order_lines(sku, name, quantity, unit_price)",
    )
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<OrderRow[]>();

  return (
    <div>
      <h1 className="text-2xl font-medium text-on-surface">Orders</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Recent sales. Voiding reverses the stock in inventory.</p>

      <div className="mt-6">
        <OrdersList orders={orders ?? []} />
      </div>
    </div>
  );
}
