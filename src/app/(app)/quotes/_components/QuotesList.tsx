"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { discardQuote, type ActionState } from "@/actions/quotes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export type QuoteRow = {
  id: string;
  subtotal: number;
  total: number;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  converted_order_id: string | null;
  staff: { full_name: string } | { full_name: string }[] | null;
  order_lines: { sku: string; name: string; quantity: number; unit_price: number }[];
};

const initialState: ActionState = { error: null };

export function QuotesList({ quotes }: { quotes: QuoteRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (quotes.length === 0) {
    return <p className="text-sm text-on-surface-variant">No quotes yet.</p>;
  }

  return (
    <div className="space-y-3">
      {quotes.map((quote) => {
        const staff = Array.isArray(quote.staff) ? quote.staff[0] : quote.staff;
        const isConverted = !!quote.converted_order_id;

        return (
          <Card key={quote.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-on-surface">
                  {quote.customer_name || "Walk-in customer"}
                  {quote.customer_phone && ` · ${quote.customer_phone}`}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {new Date(quote.created_at).toLocaleString()} · {staff?.full_name ?? "Unknown staff"}
                </p>
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === quote.id ? null : quote.id)}
                  className="mt-1 text-xs text-on-surface-variant underline underline-offset-2"
                >
                  {expanded === quote.id ? "Hide items" : `${quote.order_lines.length} item(s)`}
                </button>
                {expanded === quote.id && (
                  <ul className="mt-2 space-y-1 text-sm text-on-surface-variant">
                    {quote.order_lines.map((line, i) => (
                      <li key={i}>
                        {line.quantity} × {line.name} ({line.sku}) — $
                        {(line.unit_price * line.quantity).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="text-right">
                <p className="text-lg font-medium text-on-surface">${quote.total.toFixed(2)}</p>
                {isConverted ? (
                  <p className="mt-1 text-xs text-on-surface-variant">Converted to a sale</p>
                ) : (
                  <div className="mt-1 flex flex-col items-end gap-1">
                    <Link
                      href={`/checkout?fromQuote=${quote.id}`}
                      className="text-xs text-primary underline underline-offset-2"
                    >
                      Convert to sale
                    </Link>
                    <DiscardForm quoteId={quote.id} />
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function DiscardForm({ quoteId }: { quoteId: string }) {
  const [state, formAction, pending] = useActionState(discardQuote, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="quoteId" value={quoteId} />
      <Button type="submit" variant="secondary" disabled={pending} className="px-3 py-1 text-xs">
        {pending ? "…" : "Discard"}
      </Button>
      {state.error && <p className="mt-1 text-xs text-error">{state.error}</p>}
    </form>
  );
}
