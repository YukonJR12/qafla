-- Qafla Pickup · Dish descriptions and allergens, with AI photo suggestions
--
-- The brief: "Vendors upload a photo of a dish and the app suggests a short
-- description and the allergens it may contain. The vendor edits the
-- suggestion before saving it. A suggestion is only text for the vendor to
-- review. It never changes a price, a sold-out switch or anything else."
-- The assessment adds: "Only signed-in vendors can call your AI route, with
-- a limit per hour."
--
-- A forward migration: it adds one column, one table and two functions. No
-- existing row, order, function or access rule is changed.

-- ---------------------------------------------------------------------------
-- Allergens on a dish
-- ---------------------------------------------------------------------------
-- A fixed list of short codes. The screens translate them. Keeping the list
-- in the database means nothing else can ever be stored here, whatever a
-- model or a request sends.

create function private.known_allergens()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['gluten', 'milk', 'egg', 'peanuts', 'tree_nuts', 'sesame', 'soy', 'fish', 'shellfish', 'mustard', 'celery'];
$$;

alter table public.menu_items
  add column allergens text[] not null default '{}'
    check (allergens <@ private.known_allergens());

-- A description, when present, is short: at most 200 characters.
-- (Every seeded description is well under that.)
alter table public.menu_items
  add constraint menu_items_description_short
    check (description is null or char_length(description) <= 200);

-- `allergens` is deliberately NOT added to the columns a vendor may update
-- directly. It is written only by save_menu_copy() below.

-- ---------------------------------------------------------------------------
-- One row per photo suggestion a vendor asks for
-- ---------------------------------------------------------------------------
-- This is what the hourly limit counts. It holds no photo and no AI text.

create table public.ai_suggestion_requests (
  id bigint generated always as identity primary key,
  vendor_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.menu_items (id),
  requested_at timestamptz not null
);

create index ai_suggestion_requests_vendor_idx
  on public.ai_suggestion_requests (vendor_id, requested_at);

-- Nobody reads or writes this table through the API. Only
-- begin_ai_suggestion() below touches it.
revoke all on public.ai_suggestion_requests from anon, authenticated;
alter table public.ai_suggestion_requests enable row level security;

-- ---------------------------------------------------------------------------
-- begin_ai_suggestion
-- ---------------------------------------------------------------------------
-- The server calls this, as the signed-in vendor, BEFORE it sends a photo to
-- the AI. It answers three questions in one place:
--   1. Is this a vendor?
--   2. Is this dish on that vendor's own truck?
--   3. Has this vendor asked fewer than 20 times in the last hour?
-- If all three hold, it records the request and returns the dish's name and
-- how many requests are left this hour.
--
-- Errors use a short, stable code as the message:
--   not_a_vendor   signed out, or not a vendor account
--   not_your_dish  no such dish, or it belongs to another truck
--   rate_limited   20 suggestions already asked for in the last hour
--                  (detail: when the next one is allowed)

create function public.begin_ai_suggestion(p_item_id text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := private.clock_now();
  v_limit constant integer := 20;
  v_item public.menu_items;
  v_used integer;
  v_oldest timestamptz;
begin
  if v_user is null or private.my_role() is distinct from 'vendor' then
    raise exception 'not_a_vendor' using errcode = '42501';
  end if;

  -- Same answer whether the dish is missing or simply not yours.
  select m.* into v_item
  from public.menu_items m
  join public.trucks t on t.id = m.truck_id
  where m.id = p_item_id and t.vendor_id = v_user;
  if not found then
    raise exception 'not_your_dish' using errcode = '42501';
  end if;

  -- One request at a time per vendor, so two requests arriving together
  -- cannot both slip under the limit.
  perform 1 from public.profiles where id = v_user for update;

  select count(*), min(requested_at) into v_used, v_oldest
  from public.ai_suggestion_requests
  where vendor_id = v_user and requested_at > v_now - interval '1 hour';

  if v_used >= v_limit then
    raise exception 'rate_limited'
      using detail = to_char((v_oldest + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  insert into public.ai_suggestion_requests (vendor_id, item_id, requested_at)
  values (v_user, v_item.id, v_now);

  return json_build_object(
    'item_id', v_item.id,
    'item_name', v_item.name,
    'category', v_item.category,
    'remaining', v_limit - v_used - 1
  );
end;
$$;

revoke all on function public.begin_ai_suggestion(text) from public, anon;
grant execute on function public.begin_ai_suggestion(text) to authenticated;

-- ---------------------------------------------------------------------------
-- save_menu_copy
-- ---------------------------------------------------------------------------
-- The vendor's "Save". It changes exactly two things on one dish: the
-- description and the allergens. The price, the sold-out switch, the name
-- and the category are not parameters, so nothing sent to this function
-- can change them.
--
-- Errors:
--   not_your_dish        no such dish, or it belongs to another truck
--   description_too_long more than 200 characters
--   unknown_allergen     something outside the fixed list

create function public.save_menu_copy(
  p_item_id text,
  p_description text,
  p_allergens text[]
)
returns public.menu_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  -- Blank text is saved as "no description".
  v_description text := nullif(btrim(regexp_replace(coalesce(p_description, ''), '\s+', ' ', 'g')), '');
  v_allergens text[];
  v_item public.menu_items;
begin
  if char_length(v_description) > 200 then
    raise exception 'description_too_long' using detail = 'A description is at most 200 characters.';
  end if;

  if not (coalesce(p_allergens, '{}') <@ private.known_allergens()) then
    raise exception 'unknown_allergen' using detail = 'Allergens come from the fixed list.';
  end if;

  -- Stored without repeats, in the fixed list's order.
  select coalesce(array_agg(a order by ord), '{}') into v_allergens
  from unnest(private.known_allergens()) with ordinality as k (a, ord)
  where a = any (coalesce(p_allergens, '{}'));

  update public.menu_items m
  set description = v_description, allergens = v_allergens
  from public.trucks t
  where m.id = p_item_id and t.id = m.truck_id and t.vendor_id = v_user
  returning m.* into v_item;

  -- Same answer whether the dish is missing or simply not yours.
  if not found then
    raise exception 'not_your_dish' using errcode = '42501';
  end if;

  return v_item;
end;
$$;

revoke all on function public.save_menu_copy(text, text, text[]) from public, anon;
grant execute on function public.save_menu_copy(text, text, text[]) to authenticated;

-- The list itself is not a secret, and the check on menu_items runs as
-- whoever is updating the row, so the API roles must be able to call it.
revoke all on function private.known_allergens() from public;
grant execute on function private.known_allergens() to anon, authenticated;
