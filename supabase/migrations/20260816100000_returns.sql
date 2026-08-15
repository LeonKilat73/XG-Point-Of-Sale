-- Partial returns/refunds: reverses specific line(s) of a completed sale by
-- quantity, distinct from a full void. The original order/order_lines rows
-- are never touched -- each return is its own auditable row, same
-- philosophy as void never deleting the original stock_movements. Multiple
-- returns can be recorded against the same order_line over time; how much is
-- still refundable is always derived (order_lines.quantity minus the sum of
-- existing returns for that line), never stored, so it can't drift.
create table returns (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  order_line_id  uuid not null references order_lines(id) on delete cascade,
  quantity       integer not null check (quantity > 0),
  refund_amount  numeric(12,2) not null check (refund_amount >= 0),
  reason         text,
  staff_id       uuid references staff(id),
  created_at     timestamptz not null default now()
);

alter table returns enable row level security;

-- Same authorization posture as void: any signed-in staff can trigger a
-- refund (the manager PIN check in refundOrder is the real gate, not RLS),
-- so this just needs "is signed in" like order_lines_insert/payments_insert.
create policy returns_select on returns
  for select using (auth.uid() is not null);
create policy returns_insert on returns
  for insert with check (auth.uid() is not null);
