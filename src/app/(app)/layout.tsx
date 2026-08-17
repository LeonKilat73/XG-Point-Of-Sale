import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/staff";
import { getOpenShift } from "@/actions/shifts";
import { AppHeader } from "@/components/AppHeader";
import { ClockInPrompt } from "@/components/ClockInPrompt";
import { ClockReminderBanner } from "@/components/ClockReminderBanner";
import { ShiftProvider } from "@/components/ShiftContext";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const openShift = await getOpenShift();

  return (
    <ShiftProvider initialShift={openShift}>
      <div className="flex flex-1 flex-col">
        <AppHeader fullName={staff.fullName} role={staff.role} />
        <ClockReminderBanner />
        <ClockInPrompt />
        <main className="flex-1 overflow-y-auto bg-background p-4 text-on-surface md:p-6">{children}</main>
      </div>
    </ShiftProvider>
  );
}
