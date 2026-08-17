import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/staff";
import { getOpenShift } from "@/actions/shifts";
import { Nav } from "@/components/Nav";
import { ClockButton } from "@/components/ClockButton";
import { ClockInPrompt } from "@/components/ClockInPrompt";
import { ClockReminderBanner } from "@/components/ClockReminderBanner";
import { ShiftProvider } from "@/components/ShiftContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  const openShift = await getOpenShift();

  return (
    <ShiftProvider initialShift={openShift}>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between bg-sidebar px-6 py-4">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-base font-medium text-white">XG Point of Sale</p>
              <p className="text-xs text-sidebar-foreground-muted">Car accessories checkout</p>
            </div>
            <Nav role={staff.role} />
          </div>
          <div className="flex items-center gap-3">
            <ClockButton />
            <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-hover" />
            <div className="text-right text-sm">
              <p className="font-medium text-white">{staff.fullName}</p>
              <p className="capitalize text-sidebar-foreground-muted">{staff.role}</p>
            </div>
          </div>
        </header>
        <ClockReminderBanner />
        <ClockInPrompt />
        <main className="flex-1 overflow-y-auto bg-background p-6 text-on-surface">{children}</main>
      </div>
    </ShiftProvider>
  );
}
