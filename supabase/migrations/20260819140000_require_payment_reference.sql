-- Reverts the "add reference later" bypass added earlier today
-- (20260819110000_checkout_payment_features.sql): for security, an
-- e-wallet/bank transfer payment must have its reference number captured
-- on the spot to confirm the money actually moved, not deferred. No real
-- payment ever used reference_pending (checked live before dropping it),
-- so this is a clean removal, not a data migration.
alter table payments drop constraint payments_reference_required;
alter table payments drop column reference_pending;
alter table payments add constraint payments_reference_required
  check (method not in ('ewallet', 'bank_transfer') or reference_number is not null);
