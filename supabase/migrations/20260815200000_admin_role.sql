-- Adds an Admin tier above Manager. Admins keep every Manager power (void
-- authorization, staff/register management) and additionally get the new
-- /admin/analytics dashboard that a regular shift Manager shouldn't
-- automatically see. There's only ever been one manager account so far --
-- promote it directly rather than requiring a manual role change.
alter table staff drop constraint if exists staff_role_check;
alter table staff add constraint staff_role_check check (role in ('cashier', 'manager', 'admin'));

update staff set role = 'admin' where role = 'manager';

create or replace function fn_is_manager(p_user uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from staff where id = p_user and role in ('manager', 'admin') and is_active);
$$;

-- The very first account ever created (a from-scratch bootstrap, e.g. a
-- fresh POS instance) should become admin now that it's the true top tier,
-- not manager -- mirrors the inventory app's own bootstrap-first-user-as-
-- admin pattern. Only affects a future empty-DB bootstrap; doesn't touch
-- the already-promoted account above.
create or replace function handle_new_staff() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not exists (select 1 from staff) then
    v_role := 'admin';
  else
    v_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'cashier');
    if v_role not in ('cashier', 'manager', 'admin') then
      v_role := 'cashier';
    end if;
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
