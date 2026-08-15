"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { voidOrder, type ActionState } from "@/actions/orders";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

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
  order_lines: { sku: string; name: string; quantity: number; unit_price: number }[];
  payments: { method: string; reference_number: string | null }[];
};

const initialState: ActionState = { error: null };

function receiptNumber(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export function OrdersList({ orders }: { orders: OrderRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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
      </Card>

      {filtered.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          {orders.length === 0 ? "No orders yet." : "No orders match that search."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const staff = Array.isArray(order.staff) ? order.staff[0] : order.staff;
            const isVoided = order.status === "voided";
            const payment = order.payments[0];

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
                      <ul className="mt-2 space-y-1 text-sm text-on-surface-variant">
                        {order.order_lines.map((line, i) => (
                          <li key={i}>
                            {line.quantity} × {line.name} ({line.sku}) — $
                            {(line.unit_price * line.quantity).toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-medium text-on-surface">${order.total.toFixed(2)}</p>
                    {isVoided ? (
                      <p className="mt-1 text-xs text-error">
                        Voided {order.voided_at && new Date(order.voided_at).toLocaleString()}
                        {order.void_reason && ` — ${order.void_reason}`}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVoiding(voiding === order.id ? null : order.id)}
                        className="mt-1 text-xs text-error underline underline-offset-2"
                      >
                        Void
                      </button>
                    )}
                  </div>
                </div>

                {voiding === order.id && <VoidForm orderId={order.id} onDone={() => setVoiding(null)} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
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
