-- A manager adding a new staff account (via admin.auth.admin.createUser)
-- picks the new account's role through user_metadata.requested_role. The
-- very first account ever created still always becomes manager regardless
-- of what (if anything) was requested, since bootstrapping needs somebody
-- able to grant roles at all before anyone else can be added.
create or replace function handle_new_staff() returns trigger
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
    v_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'cashier');
    if v_role not in ('cashier', 'manager') then
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
