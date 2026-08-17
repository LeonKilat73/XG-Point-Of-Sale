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
  generateBucketsInRange,
  PERIOD_OPTIONS,
  type Period,
} from "@/lib/analyticsPeriods";

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type OrderRow = {
  id: string;
  status: "completed" | "voided" | "quote";
  total: number;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  void_reason: string | null;
  voided_at: string | null;
  converted_order_id: string | null;
};
export type PaymentRow = { order_id: string; method: string; amount: number };
export type LineRow = { order_id: string; sku: string; name: string; quantity: number; unit_price: number };
export type ReturnRow = {
  order_line_id: string;
  quantity: number;
  refund_amount: number;
  reason: string | null;
  created_at: string;
  staff: { full_name: string } | { full_name: string }[] | null;
  order_lines: { sku: string; name: string } | { sku: string; name: string }[] | null;
};
export type WarrantyReplacementRow = {
  quantity: number;
  unit_price: number;
  reason: string | null;
  created_at: string;
  staff: { full_name: string } | { full_name: string }[] | null;
  sku: string;
  name: string;
};

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
  returns,
  warrantyReplacements,
  ordersTruncated,
  oldestFetchedOrderDate,
}: {
  orders: OrderRow[];
  payments: PaymentRow[];
  lines: LineRow[];
  returns: ReturnRow[];
  warrantyReplacements: WarrantyReplacementRow[];
  ordersTruncated: boolean;
  oldestFetchedOrderDate: string | null;
}) {
  const [period, setPeriod] = useState<Period>("month");
  const [rangeMode, setRangeMode] = useState<"rolling" | "custom">("rolling");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const theme = useTheme();
  const isDark = theme === "dark";
  const ink = isDark ? CHART_INK.dark : CHART_INK.light;
  const methodColors = isDark ? METHOD_COLORS_DARK : METHOD_COLORS_LIGHT;

  const now = useMemo(() => new Date(), []);
  // Custom mode defaults to the trailing 30 days whenever the user hasn't
  // typed a from/to yet, so the date inputs are never blank -- picked once
  // from `now`, not a fresh Date() on every render (see the react-hooks
  // purity note on customerBalances below for why that matters).
  const defaultRangeStart = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return d;
  }, [now]);
  const effectiveFrom = customFrom || toDateInputValue(defaultRangeStart);
  const effectiveTo = customTo || toDateInputValue(now);

  const { buckets, windowStartDate, windowEndDate } = useMemo(() => {
    if (rangeMode === "custom") {
      const start = new Date(`${effectiveFrom}T00:00:00`);
      const end = new Date(`${effectiveTo}T23:59:59.999`);
      const [rangeStart, rangeEnd] = start <= end ? [start, end] : [end, start];
      return {
        buckets: generateBucketsInRange(period, rangeStart, rangeEnd),
        windowStartDate: rangeStart,
        windowEndDate: rangeEnd,
      };
    }
    const rolling = generateBuckets(period, now);
    return { buckets: rolling, windowStartDate: rolling[0], windowEndDate: now };
  }, [rangeMode, effectiveFrom, effectiveTo, period, now]);

  // The orders fetch is capped server-side (see analytics/page.tsx) -- if
  // that cap was actually hit AND the selected range reaches back further
  // than the oldest order that made it into the fetch, older orders in the
  // window were silently dropped rather than genuinely absent. Surface that
  // instead of showing a chart that looks complete but isn't.
  const rangeMayBeIncomplete =
    ordersTruncated && oldestFetchedOrderDate !== null && windowStartDate < new Date(oldestFetchedOrderDate);

  const completed = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "completed" &&
          new Date(o.created_at) >= windowStartDate &&
          new Date(o.created_at) <= windowEndDate,
      ),
    [orders, windowStartDate, windowEndDate],
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
        (o) =>
          o.status === "voided" &&
          o.voided_at &&
          new Date(o.voided_at) >= windowStartDate &&
          new Date(o.voided_at) <= windowEndDate,
      ),
    [orders, windowStartDate, windowEndDate],
  );
  const voidsTotal = voids.reduce((sum, o) => sum + o.total, 0);

  const refundsInWindow = useMemo(
    () =>
      returns.filter(
        (r) => new Date(r.created_at) >= windowStartDate && new Date(r.created_at) <= windowEndDate,
      ),
    [returns, windowStartDate, windowEndDate],
  );
  const refundsTotal = refundsInWindow.reduce((sum, r) => sum + r.refund_amount, 0);

  const replacementsInWindow = useMemo(
    () =>
      warrantyReplacements.filter(
        (w) => new Date(w.created_at) >= windowStartDate && new Date(w.created_at) <= windowEndDate,
      ),
    [warrantyReplacements, windowStartDate, windowEndDate],
  );
  const replacementsValue = replacementsInWindow.reduce((sum, w) => sum + w.unit_price * w.quantity, 0);

  // Not windowed by the period selector -- a customer's debt doesn't
  // respect a reporting period, this is an always-current snapshot of who
  // still owes money, same reasoning as the days-outstanding figure below.
  const customerBalances = useMemo(() => {
    const paidByOrder = new Map<string, number>();
    for (const p of payments) {
      paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + p.amount);
    }
    const byCustomer = new Map<
      string,
      { name: string; phone: string; balance: number; orders: number; oldest: Date }
    >();
    for (const o of orders) {
      if (o.status !== "completed") continue;
      const balance = Math.round((o.total - (paidByOrder.get(o.id) ?? 0)) * 100) / 100;
      if (balance <= 0) continue;
      const key = o.customer_phone || o.customer_name || o.id;
      const createdAt = new Date(o.created_at);
      const entry = byCustomer.get(key) ?? {
        name: o.customer_name || "Unknown customer",
        phone: o.customer_phone || "",
        balance: 0,
        orders: 0,
        oldest: createdAt,
      };
      entry.balance += balance;
      entry.orders += 1;
      if (createdAt < entry.oldest) entry.oldest = createdAt;
      byCustomer.set(key, entry);
    }
    return [...byCustomer.values()]
      .map((c) => ({
        ...c,
        balance: Math.round(c.balance * 100) / 100,
        daysOutstanding: Math.max(0, Math.floor((now.getTime() - c.oldest.getTime()) / 86400000)),
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [orders, payments, now]);
  const totalOutstanding = customerBalances.reduce((sum, c) => sum + c.balance, 0);
  const replacementsUnits = replacementsInWindow.reduce((sum, w) => sum + w.quantity, 0);

  const quotesInWindow = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "quote" &&
          new Date(o.created_at) >= windowStartDate &&
          new Date(o.created_at) <= windowEndDate,
      ),
    [orders, windowStartDate, windowEndDate],
  );
  const quotesConverted = quotesInWindow.filter((q) => q.converted_order_id);
  const conversionRate = quotesInWindow.length > 0 ? (quotesConverted.length / quotesInWindow.length) * 100 : 0;

  const totalRevenue = completed.reduce((sum, o) => sum + o.total, 0);
  const axisTick = { fontSize: 12, fill: ink.text };

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium text-on-surface-variant">Bucket by</span>
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

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="mr-1 text-sm font-medium text-on-surface-variant">Range</span>
            <div className="mt-1 inline-flex gap-2">
              {(["rolling", "custom"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRangeMode(m)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    rangeMode === m
                      ? "bg-primary text-on-primary"
                      : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {m === "rolling" ? `Last ${PERIOD_OPTIONS.find((p) => p.value === period)?.label.toLowerCase()}s` : "Custom range"}
                </button>
              ))}
            </div>
          </div>

          {rangeMode === "custom" && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">From</span>
                <input
                  type="date"
                  value={effectiveFrom}
                  max={effectiveTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">To</span>
                <input
                  type="date"
                  value={effectiveTo}
                  min={effectiveFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </>
          )}

          <p className="text-xs text-on-surface-variant">
            Showing {windowStartDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            {" – "}
            {windowEndDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {rangeMayBeIncomplete && (
          <p className="rounded-lg border border-error/30 bg-error-container/15 px-3 py-2 text-xs text-error">
            This shop has more order history than fits in one load -- results before{" "}
            {new Date(oldestFetchedOrderDate!).toLocaleDateString()} may be incomplete. Narrow the range to see
            everything.
          </p>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <p className="text-sm text-on-surface-variant">Revenue</p>
          <p className="mt-1 text-2xl font-medium text-on-surface">₱{totalRevenue.toFixed(2)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {completed.length} sale{completed.length === 1 ? "" : "s"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-on-surface-variant">Voided</p>
          <p className="mt-1 text-2xl font-medium text-on-surface">₱{voidsTotal.toFixed(2)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {voids.length} order{voids.length === 1 ? "" : "s"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-on-surface-variant">Refunded</p>
          <p className="mt-1 text-2xl font-medium text-on-surface">₱{refundsTotal.toFixed(2)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {refundsInWindow.length} return{refundsInWindow.length === 1 ? "" : "s"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-on-surface-variant">Replaced</p>
          <p className="mt-1 text-2xl font-medium text-on-surface">₱{replacementsValue.toFixed(2)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {replacementsUnits} unit{replacementsUnits === 1 ? "" : "s"}
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
                  tickFormatter={(v: number) => `₱${v}`}
                />
                <Tooltip
                  formatter={(value) => [`₱${Number(value).toFixed(2)}`, "Revenue"]}
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
                    <Tooltip formatter={(value) => `₱${Number(value).toFixed(2)}`} contentStyle={{ fontSize: 13 }} />
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
                    <span className="text-on-surface-variant">₱{entry.amount.toFixed(2)}</span>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  <span className="text-on-surface">₱{o.total.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Refunds</h2>
          {refundsInWindow.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No refunds in this period.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {refundsInWindow.slice(0, 10).map((r, i) => {
                const staff = Array.isArray(r.staff) ? r.staff[0] : r.staff;
                const line = Array.isArray(r.order_lines) ? r.order_lines[0] : r.order_lines;
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between border-b border-outline-variant/60 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-on-surface">
                        {r.quantity} × {line?.name ?? "Unknown item"}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {new Date(r.created_at).toLocaleDateString()} · {staff?.full_name ?? "Unknown staff"}
                        {r.reason && ` — ${r.reason}`}
                      </p>
                    </div>
                    <span className="text-on-surface">₱{r.refund_amount.toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-on-surface-variant">Warranty replacements</h2>
          {replacementsInWindow.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No warranty replacements in this period.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {replacementsInWindow.slice(0, 10).map((w, i) => {
                const staff = Array.isArray(w.staff) ? w.staff[0] : w.staff;
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between border-b border-outline-variant/60 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-on-surface">
                        {w.quantity} × {w.name}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {new Date(w.created_at).toLocaleDateString()} · {staff?.full_name ?? "Unknown staff"}
                        {w.reason && ` — ${w.reason}`}
                      </p>
                    </div>
                    <span className="text-on-surface">₱{(w.unit_price * w.quantity).toFixed(2)}</span>
                  </li>
                );
              })}
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

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-on-surface-variant">Customer balances</h2>
          <span className="text-xs text-on-surface-variant">
            Always current, not limited to the period above
          </span>
        </div>
        {customerBalances.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No outstanding customer balances.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-on-surface-variant">
              Total outstanding: <span className="font-medium text-on-surface">₱{totalOutstanding.toFixed(2)}</span>
            </p>
            <ul className="space-y-2 text-sm">
              {customerBalances.map((c) => (
                <li
                  key={c.phone || c.name}
                  className="flex items-center justify-between border-b border-outline-variant/60 pb-2 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-on-surface">
                      {c.name}
                      {c.phone && ` · ${c.phone}`}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {c.orders} order{c.orders === 1 ? "" : "s"} · {c.daysOutstanding} day
                      {c.daysOutstanding === 1 ? "" : "s"} outstanding
                    </p>
                  </div>
                  <span className="font-medium text-error">₱{c.balance.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
