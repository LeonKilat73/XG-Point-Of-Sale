-- Exchanges: the defective-item-goes-back, pricier-item-comes-out case that
-- neither refund (money back, nothing new) nor warranty replacement (free
-- like-for-like swap, no payment) covers on its own. One record captures
-- both sides -- the returned item and the new item -- plus the price
-- difference, instead of two disconnected transactions (a refund receipt
-- and a brand-new sale) that don't read as "this was one exchange" later.
--
-- Same v1 scope note as warranty_replacements: the returned unit goes back
-- through inventory's ordinary partial-return path (fn_partial_return_pos_sale),
-- which restores it to sellable stock -- it is not reported to inventory's
-- defective_items table (no API surface for that yet), so a genuinely
-- defective exchanged-in unit still needs a manual defective-stock
-- adjustment on the inventory side for now.
create table exchanges (
  id                      uuid primary key default gen_random_uuid(),
  original_order_id       uuid not null references orders(id) on delete cascade,
  original_order_line_id  uuid not null references order_lines(id) on delete cascade,
  original_item_id        uuid not null,
  original_sku            text not null,
  original_name           text not null,
  original_unit_price     numeric(12,2) not null,
  new_item_id             uuid not null,
  new_sku                 text not null,
  new_name                text not null,
  new_unit_price          numeric(12,2) not null,
  quantity                integer not null check (quantity > 0),
  -- positive: customer paid more for the new item. Zero or negative: same
  -- price or a downgrade -- no payment is collected through this flow
  -- either way (a downgrade refund, like any refund, is handled manually).
  price_difference        numeric(12,2) not null,
  payment_method          text check (payment_method in ('cash', 'card', 'ewallet', 'bank_transfer')),
  reference_number        text,
  reason                  text,
  customer_name           text,
  customer_phone          text,
  inventory_reference     uuid not null,
  staff_id                uuid references staff(id),
  created_at              timestamptz not null default now()
);

alter table exchanges enable row level security;

-- Same authorization posture as void/returns/warranty_replacements: any
-- signed-in staff can trigger one (the manager PIN check in exchangeOrder
-- is the real gate), so this just needs "is signed in".
create policy exchanges_select on exchanges
  for select using (auth.uid() is not null);
create policy exchanges_insert on exchanges
  for insert with check (auth.uid() is not null);
