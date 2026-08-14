"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { voidOrder, type ActionState } from "@/actions/orders";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

export type OrderRow = {
  id: string;
  status: "completed" | "voided";
  subtotal: number;
  total: number;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  staff: { full_name: string } | { full_name: string }[] | null;
  order_lines: { sku: string; name: string; quantity: number; unit_price: number }[];
};

const initialState: ActionState = { error: null };

export function OrdersList({ orders }: { orders: OrderRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);

  if (orders.length === 0) {
    return <p className="text-sm text-slate-400">No orders yet.</p>;
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const staff = Array.isArray(order.staff) ? order.staff[0] : order.staff;
        const isVoided = order.status === "voided";

        return (
          <Card key={order.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-slate-400">{order.id}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {new Date(order.created_at).toLocaleString()} · {staff?.full_name ?? "Unknown staff"}
                </p>
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  className="mt-1 text-xs text-slate-500 underline underline-offset-2"
                >
                  {expanded === order.id ? "Hide items" : `${order.order_lines.length} item(s)`}
                </button>
                {expanded === order.id && (
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {order.order_lines.map((line, i) => (
                      <li key={i}>
                        {line.quantity} × {line.name} ({line.sku}) — ${(line.unit_price * line.quantity).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="text-right">
                <p className="text-lg font-medium text-slate-900">${order.total.toFixed(2)}</p>
                {isVoided ? (
                  <p className="mt-1 text-xs text-red-600">
                    Voided {order.voided_at && new Date(order.voided_at).toLocaleString()}
                    {order.void_reason && ` — ${order.void_reason}`}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setVoiding(voiding === order.id ? null : order.id)}
                    className="mt-1 text-xs text-red-600 underline underline-offset-2"
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
      className="mt-4 space-y-3 rounded-xl border border-red-200 bg-red-50 p-4"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <TextField label="Reason for void" name="reason" required />
      <TextField label="Manager PIN" name="pin" type="password" inputMode="numeric" required />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
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
