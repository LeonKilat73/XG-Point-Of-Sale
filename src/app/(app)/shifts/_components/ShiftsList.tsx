"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LONG_SHIFT_HOURS } from "@/lib/shifts";

function toLocalDateInputValue(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

export type ShiftRow = {
  id: string;
  staff_id: string;
  clock_in: string;
  clock_out: string | null;
  staff: { full_name: string } | { full_name: string }[] | null;
};

export function ShiftsList({
  shifts,
  dateFrom,
  dateTo,
  truncated,
  fetchLimit,
}: {
  shifts: ShiftRow[];
  dateFrom: string;
  dateTo: string;
  truncated: boolean;
  fetchLimit: number;
}) {
  const [query, setQuery] = useState("");
  const hasDateFilter = Boolean(dateFrom || dateTo);
  const dateFromLocal = dateFrom ? toLocalDateInputValue(dateFrom) : "";
  const dateToLocal = dateTo ? toLocalDateInputValue(dateTo) : "";
  const router = useRouter();
  const now = useMemo(() => new Date(), []);

  function handleDateFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fromVal = (form.elements.namedItem("from") as HTMLInputElement).value;
    const toVal = (form.elements.namedItem("to") as HTMLInputElement).value;
    const params = new URLSearchParams();
    if (fromVal) params.set("from", new Date(`${fromVal}T00:00:00`).toISOString());
    if (toVal) params.set("to", new Date(`${toVal}T23:59:59.999`).toISOString());
    const qs = params.toString();
    router.push(qs ? `/shifts?${qs}` : "/shifts");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shifts;
    return shifts.filter((s) => {
      const staff = Array.isArray(s.staff) ? s.staff[0] : s.staff;
      return staff?.full_name.toLowerCase().includes(q) ?? false;
    });
  }, [shifts, query]);

  return (
    <div className="space-y-4">
      <Card>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">
            Search by staff name
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            className="w-full rounded-md border border-outline bg-surface px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <form
          key={`${dateFrom}|${dateTo}`}
          onSubmit={handleDateFilterSubmit}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">From</span>
            <input
              type="date"
              name="from"
              defaultValue={dateFromLocal}
              className="rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-on-surface-variant">To</span>
            <input
              type="date"
              name="to"
              defaultValue={dateToLocal}
              className="rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <Button type="submit" variant="secondary">
            Filter by date
          </Button>
          {hasDateFilter && (
            <Link href="/shifts" className="text-sm text-on-surface-variant underline underline-offset-2">
              Clear
            </Link>
          )}
        </form>
        {hasDateFilter && (
          <p className="mt-2 text-xs text-on-surface-variant">
            Showing shifts {dateFromLocal ? `from ${dateFromLocal} ` : ""}
            {dateToLocal ? `through ${dateToLocal}` : "onward"}
            {shifts.length > 0 && ` (${shifts.length} found)`}.
          </p>
        )}
        {truncated && (
          <p className="mt-2 text-xs text-error">
            More than {fetchLimit} shifts match -- narrow the date range to see everything.
          </p>
        )}
      </Card>

      {filtered.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          {shifts.length === 0
            ? hasDateFilter
              ? "No shifts in that date range."
              : "No shifts yet."
            : "No shifts match that search."}
        </p>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-on-surface-variant">
              <tr>
                <th className="pb-2 font-medium">Staff</th>
                <th className="pb-2 font-medium">Clock in</th>
                <th className="pb-2 font-medium">Clock out</th>
                <th className="pb-2 text-right font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const staff = Array.isArray(s.staff) ? s.staff[0] : s.staff;
                const clockInDate = new Date(s.clock_in);
                const clockOutDate = s.clock_out ? new Date(s.clock_out) : null;
                const hours = ((clockOutDate ?? now).getTime() - clockInDate.getTime()) / 3_600_000;
                const stillOpen = clockOutDate === null;
                const flagged = stillOpen && hours >= LONG_SHIFT_HOURS;

                return (
                  <tr key={s.id} className="border-t border-outline-variant/60">
                    <td className="py-2 text-on-surface">{staff?.full_name ?? "Unknown staff"}</td>
                    <td className="py-2 text-on-surface-variant">{clockInDate.toLocaleString()}</td>
                    <td className="py-2 text-on-surface-variant">
                      {clockOutDate ? (
                        clockOutDate.toLocaleString()
                      ) : (
                        <span className={flagged ? "font-medium text-error" : "text-on-surface-variant"}>
                          Still clocked in
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right text-on-surface">{formatDuration(hours)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
