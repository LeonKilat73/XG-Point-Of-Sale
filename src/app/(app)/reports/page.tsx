import { redirect } from "next/navigation";

// Retired in favor of /admin/analytics, which covers everything this page
// used to (and more: a real period selector instead of fixed today/week/
// month cards, plus voids/refunds/warranty/customer-balance reports) --
// kept as a redirect rather than deleting the route outright so any
// existing bookmark/link still lands somewhere useful. analytics/page.tsx
// already redirects non-admins onward to /checkout, so this needs no
// role check of its own.
export default function ReportsPage() {
  redirect("/admin/analytics");
}
