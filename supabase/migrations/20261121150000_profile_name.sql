-- Qafla Pickup · A signed-in user can change their own display name
--
-- Until now nobody could change anything on `profiles` through the API:
-- there is no UPDATE grant on that table, which is what keeps `role` out of
-- reach. That stays exactly as it is. The Account screen's "Personal
-- details" needs one thing only, the name shown on the profile card, so it
-- gets one function that changes that one column on the caller's own row.
--
-- Adds only. No row is changed and no order is touched.

create function public.set_my_name(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  -- One line of text: runs of whitespace become one space, the ends are
  -- trimmed, and an empty name is stored as "no name".
  v_name text := nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if char_length(coalesce(v_name, '')) > 60 then
    raise exception 'name_too_long' using detail = 'A name is at most 60 characters.';
  end if;

  -- Only the caller's own row, and only display_name. The role is not
  -- mentioned here, so this function cannot change it.
  update public.profiles set display_name = v_name where id = v_user;
  if not found then
    raise exception 'no_profile';
  end if;
  return v_name;
end;
$$;

revoke all on function public.set_my_name(text) from public, anon;
grant execute on function public.set_my_name(text) to authenticated;
