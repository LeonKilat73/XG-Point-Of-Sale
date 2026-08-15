export type Period = "day" | "week" | "month" | "quarter" | "year";

const WINDOW_COUNT: Record<Period, number> = {
  day: 14,
  week: 12,
  month: 12,
  quarter: 8,
  year: 5,
};

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = date.getDay();
  date.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow));
  return date;
}

function startOfQuarter(d: Date): Date {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
}

export function bucketStart(date: Date, period: Period): Date {
  switch (period) {
    case "day":
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    case "week":
      return startOfWeek(date);
    case "month":
      return new Date(date.getFullYear(), date.getMonth(), 1);
    case "quarter":
      return startOfQuarter(date);
    case "year":
      return new Date(date.getFullYear(), 0, 1);
  }
}

function addBuckets(date: Date, period: Period, count: number): Date {
  const d = new Date(date);
  switch (period) {
    case "day":
      d.setDate(d.getDate() + count);
      return d;
    case "week":
      d.setDate(d.getDate() + count * 7);
      return d;
    case "month":
      d.setMonth(d.getMonth() + count);
      return d;
    case "quarter":
      d.setMonth(d.getMonth() + count * 3);
      return d;
    case "year":
      d.setFullYear(d.getFullYear() + count);
      return d;
  }
}

export function bucketKey(date: Date, period: Period): string {
  return bucketStart(date, period).toISOString();
}

export function bucketLabel(date: Date, period: Period): string {
  switch (period) {
    case "day":
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    case "week":
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    case "month":
      return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    case "quarter":
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
    case "year":
      return String(date.getFullYear());
  }
}

// Full ordered list of bucket start dates for the window, oldest first --
// so an empty bucket still shows $0 in the chart instead of being skipped,
// which matters for a time series to read correctly (gaps look identical
// to "no data fetched" otherwise).
export function generateBuckets(period: Period, now: Date = new Date()): Date[] {
  const currentBucketStart = bucketStart(now, period);
  const count = WINDOW_COUNT[period];
  const buckets: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    buckets.push(addBuckets(currentBucketStart, period, -i));
  }
  return buckets;
}
