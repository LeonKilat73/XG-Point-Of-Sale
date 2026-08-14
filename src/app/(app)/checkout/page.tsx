import { Card } from "@/components/ui/Card";

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-medium text-slate-900">Checkout</h1>
      <p className="mt-1 text-sm text-slate-500">
        Look up an item, build a cart, and take payment.
      </p>

      <Card className="mt-6">
        <p className="text-sm text-slate-500">
          The checkout screen itself (item search, cart, payment, and posting the sale to
          inventory) is the next thing to build.
        </p>
      </Card>
    </div>
  );
}
