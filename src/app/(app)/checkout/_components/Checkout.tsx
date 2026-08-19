"use client";

import { useEffect, useState } from "react";
import {
  getMySalesToday,
  submitSale,
  type DiscountInput,
  type MySalesTodaySummary,
  type PaymentMethod,
  type PaymentTender,
} from "@/actions/checkout";
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

const INSTALLMENT_OPTIONS = [3, 6, 12] as const;
const CARD_FEE_RATE = 0.03;
const MAX_TENDERS = 3;

type TenderDraft = {
  method: PaymentMethod;
  amount: string;
  referenceNumber: string;
  referencePending: boolean;
  installmentMonths: "" | "3" | "6" | "12";
};

function newTender(defaultAmount: string): TenderDraft {
  return { method: "cash", amount: defaultAmount, referenceNumber: "", referencePending: false, installmentMonths: "" };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type ReceiptLine = { sku: string; name: string; quantity: number; unitPrice: number };
type ReceiptTender = {
  method: PaymentMethod;
  amount: number;
  referenceNumber: string;
  referencePending: boolean;
  cardFeeAmount: number;
  installmentMonths: number | null;
  installmentMonthlyAmount: number | null;
};
type Receipt = {
  orderId: string;
  createdAt: string;
  cashierName: string;
  customerName: string;
  customerPhone: string;
  lines: ReceiptLine[];
  subtotal: number;
  discountType: "percent" | "flat" | null;
  discountValue: number | null;
  discountAmount: number;
  total: number;
  tenders: ReceiptTender[];
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
  const [customerEmail, setCustomerEmail] = useState("");
  const [creditSale, setCreditSale] = useState(false);
  const [tenders, setTenders] = useState<TenderDraft[]>([newTender("")]);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [discountPin, setDiscountPin] = useState("");
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

  const discountRaw = discountEnabled
    ? discountType === "percent"
      ? subtotal * ((Number(discountValue) || 0) / 100)
      : Number(discountValue) || 0
    : 0;
  const discountAmount = Math.min(subtotal, Math.max(0, round2(discountRaw)));
  const total = round2(subtotal - discountAmount);

  const tenderAmounts = tenders.map((t) => Number(t.amount) || 0);
  const totalTendered = round2(tenderAmounts.reduce((sum, a) => sum + a, 0));
  const balanceDue = Math.max(0, round2(total - totalTendered));
  const billToMissing = creditSale && (customerName.trim().length === 0 || customerPhone.trim().length === 0);
  const discountMissing =
    discountEnabled && (!(Number(discountValue) > 0) || discountReason.trim().length === 0 || discountPin.trim().length === 0);

  const tenderIssues = tenders.map((t) => {
    const amountNumber = Number(t.amount) || 0;
    const needsReference = (t.method === "ewallet" || t.method === "bank_transfer") && amountNumber > 0;
    const referenceMissing = needsReference && !t.referencePending && t.referenceNumber.trim().length === 0;
    return { needsReference, referenceMissing };
  });
  const anyReferenceMissing = tenderIssues.some((t) => t.referenceMissing);

  function updateTender(index: number, patch: Partial<TenderDraft>) {
    setTenders((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTender() {
    const remaining = Math.max(0, round2(total - totalTendered));
    setTenders((prev) => [...prev, newTender(remaining > 0 ? String(remaining) : "")]);
  }

  function removeTender(index: number) {
    setTenders((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);

    const paymentTenders: PaymentTender[] = tenders
      .filter((t) => (Number(t.amount) || 0) > 0)
      .map((t) => ({
        method: t.method,
        amount: Number(t.amount) || 0,
        referenceNumber: t.referenceNumber.trim() || undefined,
        referencePending: t.referencePending || undefined,
        installmentMonths:
          t.method === "card" && t.installmentMonths ? (Number(t.installmentMonths) as 3 | 6 | 12) : undefined,
      }));

    const discountInput: DiscountInput | undefined = discountEnabled
      ? { type: discountType, value: Number(discountValue) || 0, reason: discountReason.trim(), pin: discountPin }
      : undefined;

    const result = await submitSale(
      cart,
      paymentTenders,
      fromQuoteId,
      { name: customerName, phone: customerPhone, email: customerEmail },
      creditSale,
      discountInput,
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
      discountType: discountEnabled ? discountType : null,
      discountValue: discountEnabled ? Number(discountValue) || 0 : null,
      discountAmount,
      total,
      tenders: paymentTenders.map((p) => ({
        method: p.method,
        amount: p.amount,
        referenceNumber: p.referenceNumber ?? "",
        referencePending: p.referencePending ?? false,
        cardFeeAmount: p.method === "card" ? round2(p.amount * CARD_FEE_RATE) : 0,
        installmentMonths: p.installmentMonths ?? null,
        installmentMonthlyAmount: p.installmentMonths ? round2(p.amount / p.installmentMonths) : null,
      })),
      change: result.change,
      balanceDue,
    });
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setTenders([newTender("")]);
    setCreditSale(false);
    setDiscountEnabled(false);
    setDiscountValue("");
    setDiscountReason("");
    setDiscountPin("");

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
                <td className="py-1.5 text-right">₱{line.unitPrice.toFixed(2)}</td>
                <td className="py-1.5 text-right">₱{(line.unitPrice * line.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between text-on-surface-variant">
            <span>Subtotal</span>
            <span>₱{receipt.subtotal.toFixed(2)}</span>
          </div>
          {receipt.discountAmount > 0 && (
            <div className="flex justify-between text-on-surface-variant">
              <span>
                Discount {receipt.discountType === "percent" ? `(${receipt.discountValue}%)` : "(flat)"}
              </span>
              <span>-₱{receipt.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-on-surface">
            <span>Total</span>
            <span>₱{receipt.total.toFixed(2)}</span>
          </div>
          {receipt.tenders.map((t, i) => (
            <div key={i} className="border-t border-outline-variant/60 pt-1">
              <div className="flex justify-between text-on-surface-variant">
                <span>Paid ({METHOD_LABELS[t.method]})</span>
                <span>₱{t.amount.toFixed(2)}</span>
              </div>
              {t.referenceNumber && (
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Reference #</span>
                  <span className="font-mono">{t.referenceNumber}</span>
                </div>
              )}
              {t.referencePending && (
                <p className="text-xs text-error">Reference number to be added</p>
              )}
              {t.cardFeeAmount > 0 && (
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Card processing fee (3%)</span>
                  <span>₱{t.cardFeeAmount.toFixed(2)}</span>
                </div>
              )}
              {t.installmentMonths && t.installmentMonthlyAmount && (
                <p className="text-xs text-on-surface-variant">
                  {t.installmentMonths} months × ₱{t.installmentMonthlyAmount.toFixed(2)}/mo
                </p>
              )}
            </div>
          ))}
          {receipt.change > 0 && (
            <div className="flex justify-between text-on-surface-variant">
              <span>Change</span>
              <span>₱{receipt.change.toFixed(2)}</span>
            </div>
          )}
          {receipt.balanceDue > 0 && (
            <div className="flex justify-between font-medium text-error">
              <span>Balance due</span>
              <span>₱{receipt.balanceDue.toFixed(2)}</span>
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
          <p className="text-lg font-medium text-on-surface">₱{mySalesToday.total.toFixed(2)}</p>
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
        <div className="grid gap-3 sm:grid-cols-3">
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
          <TextField
            label="Email (for e-receipt, optional)"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
          />
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <CartBuilder catalog={catalog} cart={cart} onCartChange={setCart} />

        <Card className="h-fit space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm text-on-surface-variant">
              <span>Subtotal</span>
              <span>₱{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-on-surface-variant">
                <span>Discount</span>
                <span>-₱{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-lg font-medium text-on-surface">
              <span>Total</span>
              <span>₱{total.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input
                type="checkbox"
                checked={discountEnabled}
                onChange={(e) => setDiscountEnabled(e.target.checked)}
              />
              Apply discount (special event/promo)
            </label>
            {discountEnabled && (
              <div className="mt-2 space-y-2 rounded-lg border border-outline-variant bg-surface-container-high p-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountType("percent")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      discountType === "percent"
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    % off
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("flat")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      discountType === "flat"
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    ₱ off
                  </button>
                </div>
                <TextField
                  label={discountType === "percent" ? "Percent off" : "Amount off"}
                  type="number"
                  step="0.01"
                  min={0}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
                <TextField
                  label="Reason (event/promo name)"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                />
                <TextField
                  label="Manager PIN"
                  type="password"
                  inputMode="numeric"
                  value={discountPin}
                  onChange={(e) => setDiscountPin(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <span className="block text-sm font-medium text-on-surface-variant">Payment</span>
            {tenders.map((tender, i) => {
              const amountNumber = Number(tender.amount) || 0;
              const { needsReference, referenceMissing } = tenderIssues[i];
              const cardFee = tender.method === "card" ? round2(amountNumber * CARD_FEE_RATE) : 0;
              const installmentMonthly =
                tender.method === "card" && tender.installmentMonths
                  ? round2(amountNumber / Number(tender.installmentMonths))
                  : null;

              return (
                <div key={i} className="space-y-2 rounded-lg border border-outline-variant p-3">
                  {tenders.length > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-on-surface-variant">Payment {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeTender(i)}
                        className="text-xs text-error underline underline-offset-2"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => updateTender(i, { method: m.value, installmentMonths: "" })}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          tender.method === m.value
                            ? "border-primary bg-primary text-on-primary"
                            : "border-outline text-on-surface-variant hover:bg-surface-container-high"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <TextField
                    label="Amount"
                    type="number"
                    step="0.01"
                    value={tender.amount}
                    onChange={(e) => updateTender(i, { amount: e.target.value })}
                  />

                  {needsReference && !tender.referencePending && (
                    <TextField
                      label={`${METHOD_LABELS[tender.method]} reference number`}
                      value={tender.referenceNumber}
                      onChange={(e) => updateTender(i, { referenceNumber: e.target.value })}
                      placeholder="From the payment confirmation"
                      required
                    />
                  )}
                  {needsReference && (
                    <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <input
                        type="checkbox"
                        checked={tender.referencePending}
                        onChange={(e) =>
                          updateTender(i, { referencePending: e.target.checked, referenceNumber: "" })
                        }
                      />
                      Customer still getting the reference number -- add it later
                    </label>
                  )}
                  {referenceMissing && (
                    <p className="text-xs text-error">Enter the reference number, or check &quot;add it later&quot;.</p>
                  )}

                  {tender.method === "card" && (
                    <div className="space-y-1.5 rounded-md bg-surface-container-high p-2">
                      {cardFee > 0 && (
                        <p className="text-xs text-on-surface-variant">
                          + ₱{cardFee.toFixed(2)} card processing fee (3%), collected on top
                        </p>
                      )}
                      <div>
                        <span className="mb-1 block text-xs font-medium text-on-surface-variant">
                          Pay in installments (optional)
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateTender(i, { installmentMonths: "" })}
                            className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                              tender.installmentMonths === ""
                                ? "border-primary bg-primary text-on-primary"
                                : "border-outline text-on-surface-variant"
                            }`}
                          >
                            Full
                          </button>
                          {INSTALLMENT_OPTIONS.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => updateTender(i, { installmentMonths: String(m) as "3" | "6" | "12" })}
                              className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                                tender.installmentMonths === String(m)
                                  ? "border-primary bg-primary text-on-primary"
                                  : "border-outline text-on-surface-variant"
                              }`}
                            >
                              {m} mo
                            </button>
                          ))}
                        </div>
                        {installmentMonthly !== null && (
                          <p className="mt-1 text-xs text-on-surface-variant">
                            {tender.installmentMonths} months × ₱{installmentMonthly.toFixed(2)}/mo
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {tenders.length < MAX_TENDERS && (
              <button
                type="button"
                onClick={addTender}
                className="text-sm text-primary underline underline-offset-2"
              >
                + Add another payment method
              </button>
            )}
          </div>

          {!creditSale && totalTendered > total && (
            <p className="text-sm text-on-surface-variant">
              Change:{" "}
              <span className="font-medium text-on-surface">₱{round2(totalTendered - total).toFixed(2)}</span>
            </p>
          )}

          {creditSale && (
            <p className="text-sm text-on-surface-variant">
              Balance due: <span className="font-medium text-error">₱{balanceDue.toFixed(2)}</span>
            </p>
          )}

          {submitError && <p className="text-sm text-error">{submitError}</p>}

          <Button
            className="w-full"
            disabled={
              cart.length === 0 ||
              submitting ||
              (!creditSale && totalTendered < total) ||
              anyReferenceMissing ||
              billToMissing ||
              discountMissing
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
