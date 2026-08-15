"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/components/ThemeToggle";
import { Card } from "@/components/ui/Card";
import {
  bucketKey,
  bucketLabel,
  generateBuckets,
  PERIOD_OPTIONS,
  type Period,
} from "@/lib/analyticsPeriods";

export type OrderRow = {
  id: string;
  status: "completed" | "voided" | "quote";
  total: number;
  created_at: string;
  customer_name: string | null;
  void_reason: string | null;
  voided_at: string | null;
  converted_order_id: string | null;
};
export type PaymentRow = { order_id: string; method: string; amount: number };
export type LineRow = { order_id: string; sku: string; name: string; quantity: number; unit_price: number };

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  ewallet: "E-wallet",
  bank_transfer: "Bank transfer",
};

// Validated 4-slot categorical palette (dataviz skill's reference palette) --
// passes CVD and normal-vision separation checks in both light and dark
// (see scripts/validate_palette.js). Two light-mode slots sit below 3:1
// contrast against the surface by design, so the legend below always shows
// the label + swatch directly rather than relying on the pie alone.
const METHOD_COLORS_LIGHT: Record<string, string> = {
  cash: "#2a78d6",
  card: "#eb6834",
  ewallet: "#1baf7a",
  bank_transfer: "#eda100",
};
const METHOD_COLORS_DARK: Record<string, string> = {
  cash: "#3987e5",
  card: "#d95926",
  ewallet: "#199e70",
  bank_transfer: "#c98500",
};
const FALLBACK_COLOR = "#898781";

// Sequential single-hue ramps for the two magnitude charts shown together
// on this page -- sales-over-time takes the default sequential hue (blue),
// outgoing items takes the next categorical slot's hue (orange), per the
// dataviz skill's guidance for two simultaneous sequential contexts.
const SALES_COLOR = { light: "#2a78d6", dark: "#3987e5" };
const ITEMS_COLOR = { light: "#eb6834", dark: "#d95926" };

const CHART_INK = {
  light: { text: "#52514e", grid: "#e1e0d9", axis: "#c3c2b7", surface: "#fcfcfb" },
  dark: { text: "#c3c2b7", grid: "#2c2c2a", axis: "#383835", surface: "#1a1a19" },
};

export function AnalyticsDashboard({
  orders,
  payments,
  lines,
}: {
  orders: OrderRow[];
  payments: PaymentRow[];
  lines: LineRow[];
}) {
  const [period, setPeriod] = useState<Period>("month");
  const theme = useTheme();
  const isDark = theme === "dark";
  const ink = isDark ? CHART_INK.dark : CHART_INK.light;
  const methodColors = isDark ? METHOD_COLORS_DARK : METHOD_COLORS_LIGHT;

  const now = useMemo(() => new Date(), []);
  const buckets = useMemo(() => generateBuckets(period, now), [period, now]);
  const windowStartDate = buckets[0];

  const completed = useMemo(
    () => orders.filter((o) => o.status === "completed" && new Date(o.created_at) >= windowStartDate),
    [orders, windowStartDate],
  );
  const completedIds = useMemo(() => new Set(completed.map((o) => o.id)), [completed]);

  const salesByBucket = useMemo(() => {
    const totals = new Map<string, number>();
    for (const b of buckets) totals.set(bucketKey(b, period), 0);
    for (const o of completed) {
      const key = bucketKey(new Date(o.created_at), period);
      totals.set(key, (totals.get(key) ?? 0) + o.total);
    }
    return buckets.map((b) => {
      const key = bucketKey(b, period);
      return { label: bucketLabel(b, period), value: Math.round((totals.get(key) ?? 0) * 100) / 100 };
    });
  }, [buckets, completed, period]);

  const paymentBreakdown = useMemo(() => {
    // Attribute each order's *total* to its payment method, not the raw
    // payments.amount -- a cash payment's amount is what the customer
    // tendered, which can exceed the total (change owed), so summing it
    // directly would overstate cash revenue by however much change was
    // given back. One payment row per order today (credit sales/multiple
    // installments land in a later phase), so first-match is exact.
    const methodByOrder = new Map<string, string>();
    for (const p of payments) {
      if (!methodByOrder.has(p.order_id)) methodByOrder.set(p.order_id, p.method);
    }
    const totals = new Map<string, number>();
    for (const o of completed) {
      const method = methodByOrder.get(o.id);
      if (!method) continue;
      totals.set(method, (totals.get(method) ?? 0) + o.total);
    }
    return [...totals.entries()]
      .map(([method, amount]) => ({
        method,
        label: METHOD_LABELS[method] ?? method,
        amount: Math.round(amount * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments, completed]);

  const outgoingItems = useMemo(() => {
    const totals = new Map<string, { name: string; quantity: number }>();
    for (const l of lines) {
      if (!completedIds.has(l.order_id)) continue;
      const entry = totals.get(l.sku) ?? { name: l.name, quantity: 0 };
      entry.quantity += l.quantity;
      totals.set(l.sku, entry);
    }
    return [...totals.entries()]
      .map(([sku, v]) => ({ sku, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [lines, completedIds]);

  const voids = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "voided" && o.voided_at && new Date(o.voided_at) >= windowStartDate,
      ),
    [orders, windowStartDate],
  );
  const voidsTotal = voids.reduce((sum, o) => sum + o.total, 0);

  const quotesInWindow = useMemo(
    () => orders.filter((o) => o.status === "quote" && new Date(o.created_at) >= windowStartDate),
    [orders, windowStartDate],
  );
  const quotesConverted = quotesInWindow.filter((q) => q.converted_order_id);
  const conversionRate = quotesInWindow.length > 0 ? (quotesConverted.length / quotesInWindow.length) * 100 : 0;

  const totalRevenue = completed.reduce((sum, o) => sum + o.total, 0);
  const axisTick = { fontSize: 12, fill: ink.text };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium text-on-surface-variant">Period</span>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                period === opt.value
                  ? "bg-primary text-on-primary"
                  : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-on-surface-variant">Revenue</p>
          <p className="mt-1 text-2xl font-medium text-on-surface">${totalRevenue.toFixed(2)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {completed.length} sale{completed.length === 1 ? "" : "s"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-on-surface-variant">Voided</p>
          <p className="mt-1 text-2xl font-medium text-on-surface">${voidsTotal.toFixed(2)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {voids.length} order{voids.length === 1 ? "" : "s"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-on-surface-variant">Quotes converted</p>
          <p className="mt-1 text-2xl font-medium text-on-surface">{conversionRate.toFixed(0)}%</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {quotesConverted.length} of {quotesInWindow.length}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Sales over time</h2>
        {totalRevenue === 0 ? (
          <p className="text-sm text-on-surface-variant">No completed sales in this period.</p>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={salesByBucket} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={ink.grid} />
                <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: ink.axis }} tickLine={false} />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
                  contentStyle={{ fontSize: 13 }}
                />
                <Bar
                  dataKey="value"
                  name="Revenue"
                  fill={isDark ? SALES_COLOR.dark : SALES_COLOR.light}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Payment method breakdown</h2>
          {paymentBreakdown.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No completed sales in this period.</p>
          ) : (
            <>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={paymentBreakdown}
                      dataKey="amount"
                      nameKey="label"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {paymentBreakdown.map((entry) => (
                        <Cell
                          key={entry.method}
                          fill={methodColors[entry.method] ?? FALLBACK_COLOR}
                          stroke={ink.surface}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} contentStyle={{ fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {paymentBreakdown.map((entry) => (
                  <li key={entry.method} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-on-surface">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: methodColors[entry.method] ?? FALLBACK_COLOR }}
                      />
                      {entry.label}
                    </span>
                    <span className="text-on-surface-variant">${entry.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Outgoing items</h2>
          {outgoingItems.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No completed sales in this period.</p>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart
                  data={outgoingItems}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={ink.grid} />
                  <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(value) => [Number(value), "Units sold"]} contentStyle={{ fontSize: 13 }} />
                  <Bar
                    dataKey="quantity"
                    name="Units sold"
                    fill={isDark ? ITEMS_COLOR.dark : ITEMS_COLOR.light}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={20}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Voids</h2>
          {voids.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No voids in this period.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {voids.slice(0, 10).map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between border-b border-outline-variant/60 pb-2 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-on-surface">{o.customer_name || "Walk-in customer"}</p>
                    <p className="text-xs text-on-surface-variant">
                      {o.voided_at && new Date(o.voided_at).toLocaleDateString()}
                      {o.void_reason && ` — ${o.void_reason}`}
                    </p>
                  </div>
                  <span className="text-on-surface">${o.total.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Quotations</h2>
          {quotesInWindow.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No quotes created in this period.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-medium text-on-surface">{quotesInWindow.length}</p>
                <p className="text-xs text-on-surface-variant">Created</p>
              </div>
              <div>
                <p className="text-xl font-medium text-on-surface">{quotesConverted.length}</p>
                <p className="text-xs text-on-surface-variant">Converted</p>
              </div>
              <div>
                <p className="text-xl font-medium text-on-surface">{conversionRate.toFixed(0)}%</p>
                <p className="text-xs text-on-surface-variant">Rate</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
