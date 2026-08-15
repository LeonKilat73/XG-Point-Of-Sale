"use client";

import { useEffect, useState } from "react";
import { getMySalesToday, submitSale, type MySalesTodaySummary, type PaymentMethod } from "@/actions/checkout";
import type { InventoryItem } from "@/lib/inventory";
import { CartBuilder, type CartLine } from "@/components/CartBuilder";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "ewallet", label: "E-wallet" },
  { value: "bank_transfer", label: "Bank transfer" },
];

const METHOD_LABELS: Record<PaymentMethod, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
) as Record<PaymentMethod, string>;

type ReceiptLine = { sku: string; name: string; quantity: number; unitPrice: number };
type Receipt = {
  orderId: string;
  createdAt: string;
  cashierName: string;
  customerName: string;
  customerPhone: string;
  lines: ReceiptLine[];
  subtotal: number;
  method: PaymentMethod;
  amountPaid: number;
  referenceNumber: string;
  change: number;
  balanceDue: number;
};

// Local calendar day, not UTC -- the server has no way to know the shop's
// timezone, so "today" has to be decided here in the browser, same
// reasoning as the Orders/Shifts/Analytics date filters.
function todayBoundsIso(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function Checkout({
  catalog,
  cashierName,
  initialCart,
  initialCustomerName,
  initialCustomerPhone,
  fromQuoteId,
  quoteNotice,
}: {
  catalog: InventoryItem[];
  cashierName: string;
  initialCart?: CartLine[];
  initialCustomerName?: string;
  initialCustomerPhone?: string;
  fromQuoteId?: string;
  quoteNotice?: string;
}) {
  const [cart, setCart] = useState<CartLine[]>(initialCart ?? []);
  const [customerName, setCustomerName] = useState(initialCustomerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone ?? "");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [creditSale, setCreditSale] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [mySalesToday, setMySalesToday] = useState<MySalesTodaySummary>({ total: 0, count: 0 });

  useEffect(() => {
    let cancelled = false;
    const { from, to } = todayBoundsIso();
    getMySalesToday(from, to).then((summary) => {
      if (!cancelled) setMySalesToday(summary);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  // Cash (change handed back) and a credit sale (paying less than the total
  // on purpose) both need a manually entered amount; card/e-wallet/bank
  // transfer otherwise always charge/send the exact total.
  const amountNumber = creditSale || method === "cash" ? Number(amount) || 0 : subtotal;
  const needsReference = (method === "ewallet" || method === "bank_transfer") && amountNumber > 0;
  const referenceMissing = needsReference && referenceNumber.trim().length === 0;
  const balanceDue = Math.max(0, subtotal - amountNumber);
  const billToMissing = creditSale && (customerName.trim().length === 0 || customerPhone.trim().length === 0);

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    const result = await submitSale(
      cart,
      { method, amount: amountNumber, referenceNumber: needsReference ? referenceNumber : undefined },
      fromQuoteId,
      { name: customerName, phone: customerPhone },
      creditSale,
    );
    setSubmitting(false);

    if ("error" in result) {
      setSubmitError(result.error);
      return;
    }

    setReceipt({
      orderId: result.orderId,
      createdAt: new Date().toISOString(),
      cashierName,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      lines: cart.map((line) => ({
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      subtotal,
      method,
      amountPaid: amountNumber,
      referenceNumber: referenceNumber.trim(),
      change: result.change,
      balanceDue,
    });
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setAmount("");
    setReferenceNumber("");
    setCreditSale(false);

    const { from, to } = todayBoundsIso();
    getMySalesToday(from, to).then(setMySalesToday);
  }

  if (receipt) {
    const receiptNumber = receipt.orderId.slice(0, 8).toUpperCase();
    return (
      <Card className="mx-auto max-w-md">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-on-surface">XG Point of Sale</h2>
          <p className="text-xs text-on-surface-variant">Car accessories</p>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-on-surface-variant">
          <span>Receipt #{receiptNumber}</span>
          <span>{new Date(receipt.createdAt).toLocaleString()}</span>
        </div>
        <p className="text-xs text-on-surface-variant">Cashier: {receipt.cashierName}</p>
        {(receipt.customerName || receipt.customerPhone) && (
          <p className="text-xs text-on-surface-variant">
            Bill to: {receipt.customerName || "—"}
            {receipt.customerPhone && ` · ${receipt.customerPhone}`}
          </p>
        )}

        <table className="mt-4 w-full text-sm">
          <thead className="border-b border-outline-variant text-left text-xs text-on-surface-variant">
            <tr>
              <th className="pb-1 font-medium">Item</th>
              <th className="pb-1 text-right font-medium">Qty</th>
              <th className="pb-1 text-right font-medium">Price</th>
              <th className="pb-1 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line) => (
              <tr key={line.sku} className="border-b border-outline-variant/60">
                <td className="py-1.5">
                  <p className="text-on-surface">{line.name}</p>
                  <p className="font-mono text-xs text-on-surface-variant">{line.sku}</p>
                </td>
                <td className="py-1.5 text-right">{line.quantity}</td>
                <td className="py-1.5 text-right">${line.unitPrice.toFixed(2)}</td>
                <td className="py-1.5 text-right">${(line.unitPrice * line.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between text-on-surface-variant">
            <span>Subtotal</span>
            <span>${receipt.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-on-surface">
            <span>Total</span>
            <span>${receipt.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-on-surface-variant">
            <span>Paid ({METHOD_LABELS[receipt.method]})</span>
            <span>${receipt.amountPaid.toFixed(2)}</span>
          </div>
          {receipt.referenceNumber && (
            <div className="flex justify-between text-on-surface-variant">
              <span>Reference #</span>
              <span className="font-mono">{receipt.referenceNumber}</span>
            </div>
          )}
          {receipt.method === "cash" && (
            <div className="flex justify-between text-on-surface-variant">
              <span>Change</span>
              <span>${receipt.change.toFixed(2)}</span>
            </div>
          )}
          {receipt.balanceDue > 0 && (
            <div className="flex justify-between font-medium text-error">
              <span>Balance due</span>
              <span>${receipt.balanceDue.toFixed(2)}</span>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-on-surface-variant">Thank you for your purchase!</p>

        <Button className="mt-6 w-full" onClick={() => setReceipt(null)}>
          Start next sale
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between py-4">
        <p className="text-sm text-on-surface-variant">My sales today</p>
        <div className="text-right">
          <p className="text-lg font-medium text-on-surface">${mySalesToday.total.toFixed(2)}</p>
          <p className="text-xs text-on-surface-variant">
            {mySalesToday.count} sale{mySalesToday.count === 1 ? "" : "s"}
          </p>
        </div>
      </Card>

      {quoteNotice && (
        <div className="rounded-lg border border-primary/30 bg-primary-container/30 px-4 py-2 text-sm text-on-surface">
          {quoteNotice}
        </div>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-on-surface-variant">
            Bill to {creditSale ? "(required for credit sales)" : "(optional)"}
          </h2>
          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input
              type="checkbox"
              checked={creditSale}
              onChange={(e) => setCreditSale(e.target.checked)}
            />
            Credit sale (partial payment)
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required={creditSale}
          />
          <TextField
            label="Mobile number"
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            required={creditSale}
          />
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <CartBuilder catalog={catalog} cart={cart} onCartChange={setCart} />

        <Card className="h-fit space-y-4">
          <div className="flex items-center justify-between text-lg font-medium text-on-surface">
            <span>Total</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">Payment method</span>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
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

          {(method === "cash" || creditSale) && (
            <TextField
              label={creditSale ? "Amount paid now (optional)" : "Amount received"}
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}

          {needsReference && (
            <TextField
              label={`${METHOD_LABELS[method]} reference number`}
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="From the payment confirmation"
              required
            />
          )}

          {method === "card" && !creditSale && (
            <p className="text-sm text-on-surface-variant">
              Charge ${subtotal.toFixed(2)} on the terminal and attach the printed receipt.
            </p>
          )}

          {!creditSale && method === "cash" && amountNumber > 0 && (
            <p className="text-sm text-on-surface-variant">
              Change:{" "}
              <span className="font-medium text-on-surface">
                ${Math.max(0, amountNumber - subtotal).toFixed(2)}
              </span>
            </p>
          )}

          {creditSale && (
            <p className="text-sm text-on-surface-variant">
              Balance due: <span className="font-medium text-error">${balanceDue.toFixed(2)}</span>
            </p>
          )}

          {submitError && <p className="text-sm text-error">{submitError}</p>}

          <Button
            className="w-full"
            disabled={
              cart.length === 0 ||
              submitting ||
              (!creditSale && amountNumber < subtotal) ||
              referenceMissing ||
              billToMissing
            }
            onClick={handleSubmit}
          >
            {submitting ? "Recording sale…" : "Complete sale"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
