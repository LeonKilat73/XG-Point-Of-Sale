import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/staff";
import { Card } from "@/components/ui/Card";
import { PinForm } from "./_components/PinForm";

export default async function SettingsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-medium text-slate-900">Settings</h1>

      {staff.role === "manager" ? (
        <Card className="mt-6">
          <h2 className="mb-1 text-lg font-medium text-slate-900">Manager PIN</h2>
          <p className="mb-4 text-sm text-slate-500">
            Used to authorize a void when a cashier starts one. Anyone who knows a valid manager PIN can
            approve a void, not just you — set one you&apos;re comfortable sharing with other managers.
          </p>
          <PinForm />
        </Card>
      ) : (
        <p className="mt-6 text-sm text-slate-500">Only managers have a PIN.</p>
      )}
    </div>
  );
}
