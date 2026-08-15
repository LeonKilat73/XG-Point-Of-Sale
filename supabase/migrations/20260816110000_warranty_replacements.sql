-- Warranty replacements: swap a defective unit for a working one, no
-- payment involved -- distinct from both void (whole sale reversed) and a
-- refund (unit returned, money back, nothing new goes out). The original
-- order/order_lines rows are never touched, same philosophy as void/return.
--
-- The replacement unit's stock decrement goes through inventory's existing
-- POST /api/v1/sales (fn_record_pos_sale, unchanged) under a *fresh*
-- inventory_reference generated for this swap -- not the original order's
-- reference, since that reference already has its own 'pos_sale' movements
-- and reusing it would confuse fn_partial_return_pos_sale's "already sold
-- vs already returned" accounting for the original sale. v1 scope: the
-- returned defective unit is not reported back to inventory's
-- defective_items table (no API surface for that yet) -- marking it
-- defective on the inventory side stays a manual step for now.
create table warranty_replacements (
  id                      uuid primary key default gen_random_uuid(),
  original_order_id       uuid not null references orders(id) on delete cascade,
  original_order_line_id  uuid not null references order_lines(id) on delete cascade,
  item_id                 uuid not null,
  sku                     text not null,
  name                    text not null,
  unit_price              numeric(12,2) not null,
  quantity                integer not null check (quantity > 0),
  reason                  text,
  customer_name           text,
  customer_phone          text,
  inventory_reference     uuid not null,
  staff_id                uuid references staff(id),
  created_at              timestamptz not null default now()
);

alter table warranty_replacements enable row level security;

-- Same authorization posture as void/returns: any signed-in staff can
-- trigger one (the manager PIN check in the server action is the real
-- gate), so this just needs "is signed in".
create policy warranty_replacements_select on warranty_replacements
  for select using (auth.uid() is not null);
create policy warranty_replacements_insert on warranty_replacements
  for insert with check (auth.uid() is not null);
