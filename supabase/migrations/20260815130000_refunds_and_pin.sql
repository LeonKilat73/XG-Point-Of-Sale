-- Refund/void support: a manager PIN gate (any signed-in staff, cashier or
-- manager, can start a void, but it only proceeds if a valid manager PIN is
-- entered -- this is the actual authorization control, not just "is the
-- signed-in user a manager") plus the void record itself on orders.

alter table staff
  add column pin_hash text;

alter table orders
  add column voided_at   timestamptz,
  add column voided_by   uuid references staff(id),
  add column void_reason text;

-- Only a manager updating their OWN pin_hash, or another manager, should be
-- able to WRITE it -- reuse the existing staff RLS (self-update or
-- fn_is_manager) rather than adding a new policy; row-level RLS already
-- scopes that safely. READING it is a different story: pin_hash still
-- needs verifying against *any* manager's PIN when a cashier starts a void
-- (see verifyManagerPin), which the existing staff_select policy
-- ("any signed-in staff can read the whole table") would otherwise expose
-- to everyone -- fine for a long password hash, not fine for a 4-6 digit
-- PIN, which is trivially brute-forced offline once the hash is visible.
-- Column-level REVOKE blocks it at the Postgres privilege level, before RLS
-- even runs, for both client roles; verification instead goes through the
-- service-role client (see src/actions/pin.ts), which isn't affected by
-- this revoke.
revoke select (pin_hash) on staff from authenticated, anon;
