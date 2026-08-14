-- POS foundation: staff accounts, registers, and the POS's own record of
-- orders/payments. Stock itself lives entirely in the separate inventory
-- app -- order_lines.item_id is inventory's item/bundle id, no foreign key
-- (different Supabase project), and a completed sale is recorded here only
-- after inventory's POST /api/v1/sales confirms it (see API.md in
-- E:\InventorySystem). This is a deliberately simpler permission model than
-- inventory's (roles + per-user overrides) -- just two fixed roles, no
-- overrides, matching the "simple 2-role model" scope for v1.

create table staff (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role        text not null default 'cashier' check (role in ('cashier', 'manager')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger staff_set_updated_at
  before update on staff
  for each row execute function extensions.moddatetime(updated_at);

-- The first person to sign up becomes manager (nobody else exists yet to
-- grant that); everyone after defaults to cashier. Same bootstrap pattern
-- as the inventory app's handle_new_user.
create function handle_new_staff() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not exists (select 1 from staff) then
    v_role := 'manager';
  else
    v_role := 'cashier';
  end if;

  insert into staff (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_role
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_staff();

create table registers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table orders (
  id                     uuid primary key default gen_random_uuid(),
  register_id            uuid references registers(id),
  staff_id               uuid references staff(id),
  status                 text not null default 'completed' check (status in ('completed', 'voided')),
  subtotal               numeric(12,2) not null default 0,
  total                  numeric(12,2) not null default 0,
  inventory_reference    uuid,
  note                   text,
  created_at             timestamptz not null default now()
);

-- One row per cart line. item_id/sku/name/unit_price are a snapshot from
-- inventory at sale time (not a live join -- inventory is a separate
-- database), so a receipt or later report reads correctly even if the
-- source item is later renamed or repriced.
create table order_lines (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  item_id      uuid not null,
  sku          text not null,
  name         text not null,
  unit_price   numeric(12,2) not null,
  quantity     integer not null check (quantity > 0),
  line_total   numeric(12,2) not null
);

create table payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  method      text not null check (method in ('cash', 'card')),
  amount      numeric(12,2) not null check (amount >= 0),
  created_at  timestamptz not null default now()
);

alter table staff enable row level security;
alter table registers enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;
alter table payments enable row level security;

create function fn_is_manager(p_user uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from staff where id = p_user and role = 'manager' and is_active);
$$;

-- Any signed-in, active staff member can read/record day-to-day data;
-- managing staff/registers, or editing an existing order (e.g. a void), is
-- manager-only.
create policy staff_select on staff
  for select using (auth.uid() is not null);
create policy staff_update_self on staff
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy staff_manage on staff
  for all using (fn_is_manager(auth.uid())) with check (fn_is_manager(auth.uid()));

create policy registers_select on registers
  for select using (auth.uid() is not null);
create policy registers_manage on registers
  for all using (fn_is_manager(auth.uid())) with check (fn_is_manager(auth.uid()));

create policy orders_select on orders
  for select using (auth.uid() is not null);
create policy orders_insert on orders
  for insert with check (auth.uid() is not null);
create policy orders_update on orders
  for update using (fn_is_manager(auth.uid())) with check (fn_is_manager(auth.uid()));

create policy order_lines_select on order_lines
  for select using (auth.uid() is not null);
create policy order_lines_insert on order_lines
  for insert with check (auth.uid() is not null);

create policy payments_select on payments
  for select using (auth.uid() is not null);
create policy payments_insert on payments
  for insert with check (auth.uid() is not null);
