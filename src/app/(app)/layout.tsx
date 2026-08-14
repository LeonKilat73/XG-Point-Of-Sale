import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/staff";
import { signOut } from "@/actions/auth";
import { Nav } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-base font-medium text-slate-900">XG Point of Sale</p>
            <p className="text-xs text-slate-500">Car accessories checkout</p>
          </div>
          <Nav />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="font-medium text-slate-900">{staff.fullName}</p>
            <p className="capitalize text-slate-500">{staff.role}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
