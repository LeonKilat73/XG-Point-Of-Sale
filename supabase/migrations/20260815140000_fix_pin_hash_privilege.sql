-- The previous migration's `revoke select (pin_hash) on staff from
-- authenticated, anon` did nothing useful: Postgres's privilege model has
-- table-level SELECT (which Supabase grants by default on every public
-- table) implicitly cover every column, and a column-level REVOKE doesn't
-- override a broader table-level GRANT that's still in place -- confirmed
-- directly against the live database (information_schema.column_privileges
-- still showed authenticated/anon with SELECT on pin_hash after the
-- "revoke", and a real signed-in client could still read it back).
--
-- The actual fix: revoke the table-level SELECT entirely, then re-grant it
-- only on the specific columns the app legitimately needs client-side --
-- everything except pin_hash.
revoke select on staff from authenticated, anon;
grant select (id, full_name, email, role, is_active, created_at, updated_at) on staff to authenticated, anon;
