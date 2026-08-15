-- E-wallet (GCash/PayMaya-style) and bank transfer payments need a
-- reference number captured before the sale can be trusted as paid --
-- unlike cash (counted in hand) or card (a physical terminal receipt gets
-- attached), there's nothing else tying the sale to money actually moving.
-- Enforced at the DB layer too, not just in the app, same as every other
-- business rule in this project.
alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('cash', 'card', 'ewallet', 'bank_transfer'));

alter table payments add column reference_number text;

alter table payments add constraint payments_reference_required
  check (method not in ('ewallet', 'bank_transfer') or reference_number is not null);
