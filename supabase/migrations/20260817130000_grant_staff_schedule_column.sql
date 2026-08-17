-- 20260815140000_fix_pin_hash_privilege.sql scoped the staff SELECT grant to
-- an explicit column list (excluding pin_hash). The schedule column added in
-- 20260817120000_staff_schedule.sql was never added to that list, so any
-- query selecting it (getCurrentStaff, /staff) got a bare "permission denied
-- for table staff" (42501) instead of just omitting the column -- Postgres
-- column-level grants fail the whole query if any requested column isn't
-- covered. This caused a production login/checkout redirect loop.
grant select (id, full_name, email, role, is_active, created_at, updated_at, schedule) on staff to authenticated, anon;
