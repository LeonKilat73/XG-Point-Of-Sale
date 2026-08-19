-- Order-level discounts (special events/promos), authorized the same way
-- void/refund already are (manager PIN, not just role). discount_amount is
-- the computed peso amount, stored rather than re-derived from
-- type+value, so a later change to the discount math never reshapes a
-- historical order's total.
alter table orders add column discount_type text check (discount_type in ('percent', 'flat'));
alter table orders add column discount_value numeric(12,2);
alter table orders add column discount_amount numeric(12,2) not null default 0;
alter table orders add column discount_reason text;
alter table orders add column discount_staff_id uuid references staff(id);

-- Bypass reference number: a cashier can defer capturing the e-wallet/bank
-- transfer reference (customer still screenshotting it, next walk-in is
-- already paying) instead of the sale being blocked. reference_pending
-- marks it as owed, to be filled in later via resolvePaymentReference.
alter table payments drop constraint payments_reference_required;
alter table payments add column reference_pending boolean not null default false;
alter table payments add constraint payments_reference_required
  check (method not in ('ewallet', 'bank_transfer') or reference_number is not null or reference_pending);

-- Card surcharge (3%) and installment plans (3/6/12mo). Both are kept OUT
-- of `amount` -- amount stays "what was actually applied to the order", so
-- balance-due math (order.total - sum(payments.amount)) never has to
-- change. card_fee_amount is the extra collected on top for card
-- processing; installment_monthly_amount is purely informational (an even
-- split of `amount`, no store-side interest in v1), stored rather than
-- recomputed so a historical receipt stays stable.
alter table payments add column card_fee_amount numeric(12,2) not null default 0;
alter table payments add column installment_months integer check (installment_months in (3, 6, 12));
alter table payments add column installment_monthly_amount numeric(12,2);

-- Email receipts need somewhere to send to.
alter table orders add column customer_email text;
