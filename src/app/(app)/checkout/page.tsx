import { getCurrentStaff } from "@/lib/auth/staff";
import { fetchCatalog } from "@/lib/inventory";
import { Checkout } from "./_components/Checkout";

export default async function CheckoutPage() {
  const staff = await getCurrentStaff();
  const catalog = await fetchCatalog().catch(() => []);

  return (
    <div>
      <h1 className="text-2xl font-medium text-slate-900">Checkout</h1>
      <p className="mt-1 text-sm text-slate-500">Look up an item, build a cart, and take payment.</p>

      <div className="mt-6">
        <Checkout catalog={catalog} cashierName={staff?.fullName ?? "Unknown"} />
      </div>
    </div>
  );
}
