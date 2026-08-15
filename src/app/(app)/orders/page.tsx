import { createClient } from "@/lib/supabase/server";
import { OrdersList, type OrderRow } from "./_components/OrdersList";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, status, subtotal, total, customer_name, customer_phone, created_at, voided_at, void_reason, staff:staff_id(full_name), order_lines(sku, name, quantity, unit_price), payments(method, reference_number)",
    )
    // Orders is real sales history -- quotes share this table (status =
    // 'quote') but live on their own /quotes page, so they're excluded here.
    .in("status", ["completed", "voided"])
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<OrderRow[]>();

  return (
    <div>
      <h1 className="text-2xl font-medium text-on-surface">Orders</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Search past sales by receipt number, customer name, mobile number, or payment reference number -- useful
        for warranty, replacement, refund, or payment reconciliation inquiries. Voiding reverses the stock in
        inventory.
      </p>

      <div className="mt-6">
        <OrdersList orders={orders ?? []} />
      </div>
    </div>
  );
}
