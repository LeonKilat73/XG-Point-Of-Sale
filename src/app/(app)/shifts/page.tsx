import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff, isManagerOrAdmin } from "@/lib/auth/staff";
import { ShiftsList, type ShiftRow } from "./_components/ShiftsList";

// Same reasoning as Orders' cap: a date-filtered query is naturally
// narrower, this mostly matters for the no-filter "recent history" view.
const SHIFT_FETCH_LIMIT = 500;

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (!isManagerOrAdmin(staff.role)) redirect("/checkout");

  const { from, to } = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("shifts")
    .select("id, staff_id, clock_in, clock_out, staff:staff_id(full_name)", { count: "exact" });

  // Anchored on clock_in (when the shift started), same idea as Orders
  // anchoring on created_at -- from/to are already full UTC instants,
  // converted from the user's local calendar day in the browser (see
  // ShiftsList) before ever reaching this query.
  if (from) query = query.gte("clock_in", from);
  if (to) query = query.lte("clock_in", to);

  const { data: shifts, count } = await query
    .order("clock_in", { ascending: false })
    .limit(SHIFT_FETCH_LIMIT)
    .returns<ShiftRow[]>();

  const truncated = (count ?? 0) > SHIFT_FETCH_LIMIT;

  return (
    <div>
      <h1 className="text-2xl font-medium text-on-surface">Shifts</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Clock in/out history for every staff member.
      </p>

      <div className="mt-6">
        <ShiftsList
          shifts={shifts ?? []}
          dateFrom={from ?? ""}
          dateTo={to ?? ""}
          truncated={truncated}
          fetchLimit={SHIFT_FETCH_LIMIT}
        />
      </div>
    </div>
  );
}
