"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  exchangeOrder,
  recordPayment,
  refundOrder,
  replaceOrder,
  voidOrder,
  type ActionState,
} from "@/actions/orders";
import type { InventoryItem } from "@/lib/inventory";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

// dateFrom/dateTo arrive as full UTC instants (see orders/page.tsx) --
// reformat to the plain yyyy-mm-dd a <input type="date"> wants, in the
// browser's own local timezone, so the date shown is the same calendar day
// the user originally picked rather than shifted by however far the shop's
// timezone sits from UTC.
function toLocalDateInputValue(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  ewallet: "E-wallet",
  bank_transfer: "Bank transfer",
};

export type OrderRow = {
  id: string;
  status: "completed" | "voided";
  subtotal: number;
  total: number;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  staff: { full_name: string } | { full_name: string }[] | null;
  order_lines: { id: string; sku: string; name: string; quantity: number; unit_price: number }[];
  payments: { method: string; reference_number: string | null; amount: number }[];
  returns: { order_line_id: string; quantity: number; refund_amount: number; reason: string | null; created_at: string }[];
  warranty_replacements: { original_order_line_id: string; quantity: number }[];
  exchanges: {
    original_order_line_id: string;
    quantity: number;
    new_sku: string;
    new_name: string;
    new_unit_price: number;
    price_difference: number;
  }[];
};

const initialState: ActionState = { error: null };

function receiptNumber(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export function OrdersList({
  orders,
  catalog,
  dateFrom,
  dateTo,
  truncated,
  fetchLimit,
}: {
  orders: OrderRow[];
  catalog: InventoryItem[];
  dateFrom: string;
  dateTo: string;
  truncated: boolean;
  fetchLimit: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [refundingLine, setRefundingLine] = useState<string | null>(null);
  const [replacingLine, setReplacingLine] = useState<string | null>(null);
  const [exchangingLine, setExchangingLine] = useState<string | null>(null);
  const [payingOrder, setPayingOrder] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const hasDateFilter = Boolean(dateFrom || dateTo);
  const dateFromLocal = dateFrom ? toLocalDateInputValue(dateFrom) : "";
  const dateToLocal = dateTo ? toLocalDateInputValue(dateTo) : "";
  const router = useRouter();

  // Converts the two local-calendar-day inputs to the correct UTC instants
  // before navigating -- the server has no way to know the shop's
  // timezone, so this has to happen here, in the browser, using the
  // browser's own offset. A plain yyyy-mm-dd from the input, parsed
  // without a "Z" suffix, is interpreted by the JS Date constructor as
  // local time, which is exactly what's wanted.
  function handleDateFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fromVal = (form.elements.namedItem("from") as HTMLInputElement).value;
    const toVal = (form.elements.namedItem("to") as HTMLInputElement).value;
    const params = new URLSearchParams();
    if (fromVal) params.set("from", new Date(`${fromVal}T00:00:00`).toISOString());
    if (toVal) params.set("to", new Date(`${toVal}T23:59:59.999`).toISOString());
    const qs = params.toString();
    router.push(qs ? `/orders?${qs}` : "/orders");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (order) =>
        receiptNumber(order.id).toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q) ||
        (order.customer_name?.toLowerCase().includes(q) ?? false) ||
        (order.customer_phone?.toLowerCase().includes(q) ?? false) ||
        order.payments.some((p) => p.reference_number?.toLowerCase().includes(q) ?? false),
    );
  }, [orders, query]);

  return (
    <div className="space-y-4">
      <Card>
        <TextField
          label="Search by receipt number, customer name, mobile number, or reference number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />

        <form
          key={`${dateFrom}|${dateTo}`}
          onSubmit={handleDateFilterSubmit}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">From</span>
            <input
              type="date"
              name="from"
              defaultValue={dateFromLocal}
              className="rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">To</span>
            <input
              type="date"
              name="to"
              defaultValue={dateToLocal}
              className="rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <Button type="submit" variant="secondary">
            Filter by date
          </Button>
          {hasDateFilter && (
            <Link href="/orders" className="text-sm text-on-surface-variant underline underline-offset-2">
              Clear
            </Link>
          )}
        </form>
        {hasDateFilter && (
          <p className="mt-2 text-xs text-on-surface-variant">
            Showing orders {dateFromLocal ? `from ${dateFromLocal} ` : ""}
            {dateToLocal ? `through ${dateToLocal}` : "onward"}
            {orders.length > 0 && ` (${orders.length} found)`}.
          </p>
        )}
        {truncated && (
          <p className="mt-2 text-xs text-error">
            More than {fetchLimit} orders match -- narrow the date range to see everything.
          </p>
        )}
      </Card>

      {filtered.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          {orders.length === 0
            ? hasDateFilter
              ? "No orders in that date range."
              : "No orders yet."
            : "No orders match that search."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const staff = Array.isArray(order.staff) ? order.staff[0] : order.staff;
            const isVoided = order.status === "voided";
            const payment = order.payments[0];
            const paidSoFar = order.payments.reduce((sum, p) => sum + p.amount, 0);
            const balanceDue = Math.round((order.total - paidSoFar) * 100) / 100;

            return (
              <Card key={order.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs text-on-surface-variant">
                      #{receiptNumber(order.id)}
                    </p>
                    <p className="mt-1 text-sm text-on-surface">
                      {order.customer_name || order.customer_phone
                        ? [order.customer_name, order.customer_phone].filter(Boolean).join(" · ")
                        : "Walk-in customer"}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {new Date(order.created_at).toLocaleString()} · {staff?.full_name ?? "Unknown staff"}
                    </p>
                    {payment && (
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {METHOD_LABELS[payment.method] ?? payment.method}
                        {payment.reference_number && (
                          <>
                            {" "}
                            · Ref <span className="font-mono">{payment.reference_number}</span>
                          </>
                        )}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                      className="mt-1 text-xs text-on-surface-variant underline underline-offset-2"
                    >
                      {expanded === order.id ? "Hide items" : `${order.order_lines.length} item(s)`}
                    </button>
                    {expanded === order.id && (
                      <ul className="mt-2 space-y-2 text-sm text-on-surface-variant">
                        {order.order_lines.map((line) => {
                          const returnedQty = order.returns
                            .filter((r) => r.order_line_id === line.id)
                            .reduce((sum, r) => sum + r.quantity, 0);
                          const replacedQty = order.warranty_replacements
                            .filter((w) => w.original_order_line_id === line.id)
                            .reduce((sum, w) => sum + w.quantity, 0);
                          const lineExchanges = order.exchanges.filter(
                            (ex) => ex.original_order_line_id === line.id,
                          );
                          const exchangedQty = lineExchanges.reduce((sum, ex) => sum + ex.quantity, 0);
                          const remaining = line.quantity - returnedQty - replacedQty - exchangedQty;

                          return (
                            <li key={line.id}>
                              <div className="flex items-center justify-between gap-2">
                                <span>
                                  {line.quantity} × {line.name} ({line.sku}) — ₱
                                  {(line.unit_price * line.quantity).toFixed(2)}
                                  {returnedQty > 0 && ` — ${returnedQty} refunded`}
                                  {replacedQty > 0 && ` — ${replacedQty} replaced`}
                                  {exchangedQty > 0 && ` — ${exchangedQty} exchanged`}
                                </span>
                                {!isVoided && remaining > 0 && (
                                  <span className="flex shrink-0 gap-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setRefundingLine(refundingLine === line.id ? null : line.id)
                                      }
                                      className="text-xs text-error underline underline-offset-2"
                                    >
                                      Refund
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReplacingLine(replacingLine === line.id ? null : line.id)
                                      }
                                      className="text-xs text-on-surface-variant underline underline-offset-2"
                                    >
                                      Warranty replace
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExchangingLine(exchangingLine === line.id ? null : line.id)
                                      }
                                      className="text-xs text-primary underline underline-offset-2"
                                    >
                                      Exchange
                                    </button>
                                  </span>
                                )}
                              </div>
                              {lineExchanges.length > 0 && (
                                <ul className="mt-1 space-y-0.5 pl-3 text-xs text-on-surface-variant">
                                  {lineExchanges.map((ex, i) => (
                                    <li key={i}>
                                      → {ex.quantity} × {ex.new_name} ({ex.new_sku}) — ₱{ex.new_unit_price} ·{" "}
                                      {ex.price_difference > 0
                                        ? `customer paid ₱${ex.price_difference.toFixed(2)} more`
                                        : ex.price_difference < 0
                                          ? `₱${Math.abs(ex.price_difference).toFixed(2)} owed to customer`
                                          : "same price"}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {refundingLine === line.id && (
                                <RefundForm
                                  orderId={order.id}
                                  orderLineId={line.id}
                                  maxQuantity={remaining}
                                  unitPrice={line.unit_price}
                                  onDone={() => setRefundingLine(null)}
                                />
                              )}
                              {replacingLine === line.id && (
                                <WarrantyForm
                                  orderId={order.id}
                                  orderLineId={line.id}
                                  maxQuantity={remaining}
                                  defaultCustomerName={order.customer_name}
                                  defaultCustomerPhone={order.customer_phone}
                                  onDone={() => setReplacingLine(null)}
                                />
                              )}
                              {exchangingLine === line.id && (
                                <ExchangeForm
                                  orderId={order.id}
                                  orderLineId={line.id}
                                  maxQuantity={remaining}
                                  unitPrice={line.unit_price}
                                  catalog={catalog}
                                  defaultCustomerName={order.customer_name}
                                  defaultCustomerPhone={order.customer_phone}
                                  onDone={() => setExchangingLine(null)}
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-medium text-on-surface">₱{order.total.toFixed(2)}</p>
                    {!isVoided && balanceDue > 0 && (
                      <p className="mt-1 text-xs text-error">Balance due: ₱{balanceDue.toFixed(2)}</p>
                    )}
                    {isVoided ? (
                      <p className="mt-1 text-xs text-error">
                        Voided {order.voided_at && new Date(order.voided_at).toLocaleString()}
                        {order.void_reason && ` — ${order.void_reason}`}
                      </p>
                    ) : (
                      <div className="mt-1 flex flex-col items-end gap-1">
                        {balanceDue > 0 && (
                          <button
                            type="button"
                            onClick={() => setPayingOrder(payingOrder === order.id ? null : order.id)}
                            className="text-xs text-primary underline underline-offset-2"
                          >
                            Record payment
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setVoiding(voiding === order.id ? null : order.id)}
                          className="text-xs text-error underline underline-offset-2"
                        >
                          Void
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {payingOrder === order.id && (
                  <PaymentForm
                    orderId={order.id}
                    balanceDue={balanceDue}
                    onDone={() => setPayingOrder(null)}
                  />
                )}
                {voiding === order.id && <VoidForm orderId={order.id} onDone={() => setVoiding(null)} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RefundForm({
  orderId,
  orderLineId,
  maxQuantity,
  unitPrice,
  onDone,
}: {
  orderId: string;
  orderLineId: string;
  maxQuantity: number;
  unitPrice: number;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(refundOrder, initialState);
  const [quantity, setQuantity] = useState(1);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form
      action={formAction}
      className="mt-2 space-y-3 rounded-xl border border-error/30 bg-error-container/15 p-4"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderLineId" value={orderLineId} />
      <TextField
        label={`Quantity to refund (max ${maxQuantity})`}
        name="quantity"
        type="number"
        min={1}
        max={maxQuantity}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        required
      />
      <p className="text-xs text-on-surface-variant">
        Refund amount: ₱{(unitPrice * Math.max(1, Math.min(quantity, maxQuantity))).toFixed(2)}
      </p>
      <TextField label="Reason for refund" name="reason" required />
      <TextField label="Manager PIN" name="pin" type="password" inputMode="numeric" required />
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Refunding…" : "Confirm refund"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function WarrantyForm({
  orderId,
  orderLineId,
  maxQuantity,
  defaultCustomerName,
  defaultCustomerPhone,
  onDone,
}: {
  orderId: string;
  orderLineId: string;
  maxQuantity: number;
  defaultCustomerName: string | null;
  defaultCustomerPhone: string | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(replaceOrder, initialState);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form
      action={formAction}
      className="mt-2 space-y-3 rounded-xl border border-outline-variant bg-surface-container-high p-4"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderLineId" value={orderLineId} />
      <TextField
        label={`Quantity to replace (max ${maxQuantity})`}
        name="quantity"
        type="number"
        min={1}
        max={maxQuantity}
        defaultValue={1}
        required
      />
      <TextField label="Reason (defect description)" name="reason" required />
      <TextField label="Customer name" name="customerName" defaultValue={defaultCustomerName ?? ""} />
      <TextField
        label="Mobile number"
        name="customerPhone"
        type="tel"
        defaultValue={defaultCustomerPhone ?? ""}
      />
      <TextField label="Manager PIN" name="pin" type="password" inputMode="numeric" required />
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Replacing…" : "Confirm replacement"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const EXCHANGE_PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "ewallet", label: "E-wallet" },
  { value: "bank_transfer", label: "Bank transfer" },
];

// A defective item goes back, a different (usually pricier) item goes out,
// and the price difference is collected in the same step -- distinct from
// Refund (money back, nothing new) and Warranty replace (free, same item
// only). Reuses the checkout-style "search the catalog, pick one" pattern
// for the new item instead of a giant <select> with the whole catalog in it.
function ExchangeForm({
  orderId,
  orderLineId,
  maxQuantity,
  unitPrice,
  catalog,
  defaultCustomerName,
  defaultCustomerPhone,
  onDone,
}: {
  orderId: string;
  orderLineId: string;
  maxQuantity: number;
  unitPrice: number;
  catalog: InventoryItem[];
  defaultCustomerName: string | null;
  defaultCustomerPhone: string | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(exchangeOrder, initialState);
  const [quantity, setQuantity] = useState(1);
  const [newItem, setNewItem] = useState<InventoryItem | null>(null);
  const [itemQuery, setItemQuery] = useState("");
  const [method, setMethod] = useState("cash");

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  const q = itemQuery.trim().toLowerCase();
  const matches = q
    ? catalog
        .filter((item) => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q))
        .slice(0, 8)
    : [];

  const effectiveQuantity = Math.max(1, Math.min(quantity, maxQuantity));
  const priceDifference = newItem
    ? Math.round((newItem.unitPrice ?? 0) * effectiveQuantity * 100 - unitPrice * effectiveQuantity * 100) / 100
    : 0;
  const needsPayment = priceDifference > 0;
  const needsReference = needsPayment && (method === "ewallet" || method === "bank_transfer");

  return (
    <form
      action={formAction}
      className="mt-2 space-y-3 rounded-xl border border-primary/30 bg-primary-container/15 p-4"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderLineId" value={orderLineId} />
      {newItem && (
        <>
          <input type="hidden" name="newItemId" value={newItem.id} />
          <input type="hidden" name="newSku" value={newItem.sku} />
          <input type="hidden" name="newName" value={newItem.name} />
          <input type="hidden" name="newUnitPrice" value={newItem.unitPrice ?? 0} />
        </>
      )}
      {needsPayment && <input type="hidden" name="paymentMethod" value={method} />}

      <TextField
        label={`Quantity to exchange (max ${maxQuantity})`}
        name="quantity"
        type="number"
        min={1}
        max={maxQuantity}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        required
      />

      {newItem ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-outline bg-surface px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm text-on-surface">{newItem.name}</p>
            <p className="font-mono text-xs text-on-surface-variant">
              {newItem.sku} · ₱{newItem.unitPrice ?? 0}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNewItem(null)}
            className="shrink-0 text-xs text-primary underline underline-offset-2"
          >
            Change
          </button>
        </div>
      ) : (
        <div>
          <TextField
            label="New item (search by name or SKU)"
            value={itemQuery}
            onChange={(e) => setItemQuery(e.target.value)}
            autoComplete="off"
          />
          {matches.length > 0 && (
            <div className="mt-1 space-y-1 rounded-lg border border-outline-variant bg-surface p-1">
              {matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setNewItem(item);
                    setItemQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-container-high"
                >
                  <span className="truncate text-on-surface">{item.name}</span>
                  <span className="shrink-0 font-mono text-xs text-on-surface-variant">
                    {item.sku} · ₱{item.unitPrice ?? 0}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {newItem && (
        <p className="text-sm text-on-surface">
          {priceDifference > 0 && `Customer pays ₱${priceDifference.toFixed(2)} more.`}
          {priceDifference < 0 && `₱${Math.abs(priceDifference).toFixed(2)} owed back to the customer (handle that part manually).`}
          {priceDifference === 0 && "Same price -- no difference to collect."}
        </p>
      )}

      {needsPayment && (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">
            How the difference was paid
          </span>
          <div className="grid grid-cols-2 gap-2">
            {EXCHANGE_PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  method === m.value
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {needsReference && (
        <TextField label="Reference number" name="referenceNumber" placeholder="From the payment confirmation" required />
      )}

      <TextField label="Reason (defect description)" name="reason" required />
      <TextField label="Customer name" name="customerName" defaultValue={defaultCustomerName ?? ""} />
      <TextField
        label="Mobile number"
        name="customerPhone"
        type="tel"
        defaultValue={defaultCustomerPhone ?? ""}
      />
      <TextField label="Manager PIN" name="pin" type="password" inputMode="numeric" required />
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !newItem}>
          {pending ? "Exchanging…" : "Confirm exchange"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const RECORD_PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "ewallet", label: "E-wallet" },
  { value: "bank_transfer", label: "Bank transfer" },
];

function PaymentForm({
  orderId,
  balanceDue,
  onDone,
}: {
  orderId: string;
  balanceDue: number;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(recordPayment, initialState);
  const [method, setMethod] = useState("cash");
  const needsReference = method === "ewallet" || method === "bank_transfer";

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3 rounded-xl border border-outline-variant bg-surface-container-high p-4"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="method" value={method} />
      <div>
        <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">Payment method</span>
        <div className="grid grid-cols-2 gap-2">
          {RECORD_PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                method === m.value
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <TextField
        label={`Amount received (balance due ₱${balanceDue.toFixed(2)})`}
        name="amount"
        type="number"
        step="0.01"
        min={0.01}
        max={balanceDue}
        defaultValue={balanceDue}
        required
      />
      {needsReference && (
        <TextField label="Reference number" name="referenceNumber" placeholder="From the payment confirmation" required />
      )}
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Confirm payment"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function VoidForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(voidOrder, initialState);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      onDone();
    }
    wasPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3 rounded-xl border border-error/30 bg-error-container/15 p-4"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <TextField label="Reason for void" name="reason" required />
      <TextField label="Manager PIN" name="pin" type="password" inputMode="numeric" required />
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Voiding…" : "Confirm void"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
