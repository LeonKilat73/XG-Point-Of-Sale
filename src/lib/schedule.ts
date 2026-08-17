// A staff member's optional weekly recurring schedule, stored as one JSONB
// column (see the 20260817120000_staff_schedule.sql migration) rather than
// a separate table -- it's always exactly 7 day-slots per person, never
// queried across staff, so one column is simpler than a join.

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type DayEntry = { start: string; end: string } | null;
export type WeekSchedule = Partial<Record<DayKey, DayEntry>>;

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

// JS Date.getDay(): 0=Sunday..6=Saturday.
const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function todayKey(date: Date): DayKey {
  return JS_DAY_TO_KEY[date.getDay()];
}

// How long before a scheduled shift end the reminder popup starts showing
// (see ShiftEndReminder.tsx) -- shared here so it's one number, not a
// magic constant duplicated wherever it's referenced or displayed.
export const REMINDER_LEAD_MINUTES = 5;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Parses the JSON a ScheduleEditor submits (a hidden form field), dropping
// anything that isn't a real day key or a valid "HH:MM" pair rather than
// rejecting the whole submission -- a malformed single day just ends up
// off (no reminder for that day) instead of blocking the save.
export function parseScheduleFormValue(raw: string): WeekSchedule {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) return {};

  const result: WeekSchedule = {};
  for (const day of DAY_KEYS) {
    const entry = (parsed as Record<string, unknown>)[day];
    if (
      entry &&
      typeof entry === "object" &&
      TIME_RE.test((entry as Record<string, unknown>).start as string) &&
      TIME_RE.test((entry as Record<string, unknown>).end as string)
    ) {
      result[day] = {
        start: (entry as { start: string }).start,
        end: (entry as { end: string }).end,
      };
    }
  }
  return result;
}
