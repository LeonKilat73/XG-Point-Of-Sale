"use client";

import { useState } from "react";
import { DAY_KEYS, DAY_LABELS, type DayKey, type WeekSchedule } from "@/lib/schedule";

const DEFAULT_START = "08:00";
const DEFAULT_END = "17:00";

// A weekly recurring schedule editor -- 7 rows, each a "works this day"
// checkbox plus start/end time pickers, disabled when the day is off.
// Serializes to one hidden JSON field so it plugs into the existing
// FormData + server action pattern the rest of this app's forms use,
// rather than needing 14 separate named inputs.
export function ScheduleEditor({
  name = "schedule",
  defaultSchedule,
}: {
  name?: string;
  defaultSchedule?: WeekSchedule | null;
}) {
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule ?? {});

  function toggleDay(day: DayKey, enabled: boolean) {
    setSchedule((prev) => ({
      ...prev,
      [day]: enabled ? { start: prev[day]?.start ?? DEFAULT_START, end: prev[day]?.end ?? DEFAULT_END } : null,
    }));
  }

  function updateTime(day: DayKey, field: "start" | "end", value: string) {
    setSchedule((prev) => {
      const current = prev[day];
      if (!current) return prev;
      return { ...prev, [day]: { ...current, [field]: value } };
    });
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(schedule)} />
      {DAY_KEYS.map((day) => {
        const entry = schedule[day];
        const enabled = !!entry;
        return (
          <div key={day} className="flex flex-wrap items-center gap-3">
            <label className="flex w-32 shrink-0 items-center gap-2 text-sm text-on-surface">
              <input type="checkbox" checked={enabled} onChange={(e) => toggleDay(day, e.target.checked)} />
              {DAY_LABELS[day]}
            </label>
            <input
              type="time"
              value={entry?.start ?? DEFAULT_START}
              onChange={(e) => updateTime(day, "start", e.target.value)}
              disabled={!enabled}
              className="rounded-md border border-outline bg-surface px-2 py-1 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
            />
            <span className="text-sm text-on-surface-variant">to</span>
            <input
              type="time"
              value={entry?.end ?? DEFAULT_END}
              onChange={(e) => updateTime(day, "end", e.target.value)}
              disabled={!enabled}
              className="rounded-md border border-outline bg-surface px-2 py-1 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
            />
          </div>
        );
      })}
    </div>
  );
}
