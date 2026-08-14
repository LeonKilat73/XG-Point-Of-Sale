import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/auth/staff";
import { Card } from "@/components/ui/Card";
import { AddStaffForm } from "./_components/AddStaffForm";
import { StaffList, type StaffRow } from "./_components/StaffList";

export default async function StaffPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (staff.role !== "manager") redirect("/checkout");

  const supabase = await createClient();
  const { data: staffRows } = await supabase
    .from("staff")
    .select("id, full_name, email, role, is_active")
    .order("created_at", { ascending: true })
    .returns<StaffRow[]>();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-slate-900">Staff</h1>
        <p className="mt-1 text-sm text-slate-500">Add cashiers and managers, and manage existing accounts.</p>
      </div>

      <Card className="max-w-md">
        <h2 className="mb-4 text-lg font-medium text-slate-900">Add staff member</h2>
        <AddStaffForm />
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium text-slate-900">All staff</h2>
        <StaffList staff={staffRows ?? []} currentStaffId={staff.id} />
      </div>
    </div>
  );
}
