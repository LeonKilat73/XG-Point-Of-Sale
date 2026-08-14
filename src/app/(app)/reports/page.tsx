import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

type OrderRow = {
  id: string;
  status: "completed" | "voided";
  total: number;
  created_at: string;
  staff: { full_name: string } | { full_name: string }[] | null;
};

type LineRow = {
  order_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, total, created_at, staff:staff_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(1000)
    .returns<OrderRow[]>();

  const allOrders = orders ?? [];
  const orderIds = allOrders.map((o) => o.id);

  const { data: lines } =
    orderIds.length > 0
      ? await supabase
          .from("order_lines")
          .select("order_id, sku, name, quantity, unit_price")
          .in("order_id", orderIds)
          .returns<LineRow[]>()
      : { data: [] as LineRow[] };

  const completed = allOrders.filter((o) => o.status === "completed");
  const completedIds = new Set(completed.map((o) => o.id));

  const now = new Date();
  const todayStr = isoDate(now);

  const startOfWeek = new Date(now);
  const dow = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() + ((dow === 0 ? -6 : 1) - dow));
  const startOfWeekStr = isoDate(startOfWeek);

  const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const since = (dateStr: string) => completed.filter((o) => o.created_at >= dateStr);
  const periods = [
    { label: "Today", orders: since(todayStr) },
    { label: "This week", orders: since(startOfWeekStr) },
    { label: "This month", orders: since(startOfMonthStr) },
  ];

  // Top-selling items -- only lines from completed orders count.
  const bySku = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const line of lines ?? []) {
    if (!completedIds.has(line.order_id)) continue;
    const entry = bySku.get(line.sku) ?? { name: line.name, quantity: 0, revenue: 0 };
    entry.quantity += line.quantity;
    entry.revenue += line.unit_price * line.quantity;
    bySku.set(line.sku, entry);
  }
  const topItems = [...bySku.entries()]
    .map(([sku, v]) => ({ sku, ...v }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  // Per-staff performance -- completed orders only.
  const byStaff = new Map<string, { count: number; total: number }>();
  for (const order of completed) {
    const staff = Array.isArray(order.staff) ? order.staff[0] : order.staff;
    const name = staff?.full_name ?? "Unknown";
    const entry = byStaff.get(name) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += order.total;
    byStaff.set(name, entry);
  }
  const staffPerformance = [...byStaff.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-on-surface">Reports</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Voided sales are excluded from every figure here.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {periods.map((p) => (
          <Card key={p.label}>
            <p className="text-sm text-on-surface-variant">{p.label}</p>
            <p className="mt-1 text-2xl font-medium text-on-surface">
              ${p.orders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {p.orders.length} sale{p.orders.length === 1 ? "" : "s"}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Top-selling items</h2>
          {topItems.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No completed sales yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-on-surface-variant">
                <tr>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 text-right font-medium">Qty sold</th>
                  <th className="pb-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item) => (
                  <tr key={item.sku} className="border-t border-outline-variant/60">
                    <td className="py-2">
                      <p className="text-on-surface">{item.name}</p>
                      <p className="font-mono text-xs text-on-surface-variant">{item.sku}</p>
                    </td>
                    <td className="py-2 text-right text-on-surface">{item.quantity}</td>
                    <td className="py-2 text-right text-on-surface">${item.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Staff performance</h2>
          {staffPerformance.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No completed sales yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-on-surface-variant">
                <tr>
                  <th className="pb-2 font-medium">Staff</th>
                  <th className="pb-2 text-right font-medium">Sales</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {staffPerformance.map((s) => (
                  <tr key={s.name} className="border-t border-outline-variant/60">
                    <td className="py-2 text-on-surface">{s.name}</td>
                    <td className="py-2 text-right text-on-surface">{s.count}</td>
                    <td className="py-2 text-right text-on-surface">${s.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
