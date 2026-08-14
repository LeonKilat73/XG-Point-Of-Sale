-- Clock in/out. A staff member can only start/end their own shift; a
-- manager can also close out someone else's (e.g. a forgotten clock-out).
-- Visibility mirrors orders: any signed-in staff can see the full list,
-- consistent with how this app hasn't needed per-user data isolation
-- anywhere else yet.
create table shifts (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff(id),
  clock_in    timestamptz not null default now(),
  clock_out   timestamptz,
  created_at  timestamptz not null default now()
);

alter table shifts enable row level security;

create policy shifts_select on shifts
  for select using (auth.uid() is not null);
create policy shifts_insert_self on shifts
  for insert with check (staff_id = auth.uid());
create policy shifts_update_self on shifts
  for update using (staff_id = auth.uid()) with check (staff_id = auth.uid());
create policy shifts_manage on shifts
  for all using (fn_is_manager(auth.uid())) with check (fn_is_manager(auth.uid()));
