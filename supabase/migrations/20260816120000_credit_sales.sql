-- Credit sales: a completed order can now be paid off over multiple
-- payments rather than all at once. No new column on orders for this --
-- balance due is always *derived* (order.total - sum(payments.amount)),
-- never stored, so it can't drift out of sync with the payments actually
-- recorded. staff_id lets each installment be attributed to whoever
-- collected it (submitSale's initial payment and the new "record a
-- payment" action both set it going forward; existing rows stay null).
alter table payments
  add column staff_id uuid references staff(id);
