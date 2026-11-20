-- Qafla Pickup · Ratings
--
-- The brief: "1 to 5 stars and an optional comment. Only the customer of a
-- collected order can rate it, and only once."
--
-- A forward migration: it only adds a table and a function. No existing
-- table, order, function or access rule is changed.

create table public.order_ratings (
  -- The order is the primary key, so an order can have one rating at most.
  -- This is what makes "only once" true even if two requests arrive together.
  order_id uuid primary key references public.orders (id) on delete cascade,
  -- Copied from the order by rate_order, so the access rule below does not
  -- need to look the order up.
  customer_id uuid not null references public.profiles (id),
  truck_id text not null references public.trucks (id),
  stars smallint not null check (stars between 1 and 5),
  -- Optional. When present it has real text and is at most 500 characters.
  comment text check (comment is null or (comment ~ '\S' and char_length(comment) <= 500)),
  rated_at timestamptz not null
);

create index order_ratings_truck_idx on public.order_ratings (truck_id);

-- Grants: nobody writes to this table through the API. Ratings are only
-- ever created by rate_order() below.
revoke all on public.order_ratings from anon, authenticated;
grant select on public.order_ratings to authenticated;

-- Rows: the customer who wrote it, the vendor of that truck, the manager.
alter table public.order_ratings enable row level security;

create policy order_ratings_select on public.order_ratings
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or truck_id = (select private.my_truck_id())
    or (select private.is_manager())
  );

-- ---------------------------------------------------------------------------
-- rate_order
-- ---------------------------------------------------------------------------
-- Errors use a short, stable code as the message, like the order functions:
--   order_not_found      not your order (or no such order)
--   order_not_collected  the order has not been collected
--   invalid_stars        not a whole number from 1 to 5
--   comment_too_long     more than 500 characters
--   already_rated        this order has a rating; it is not changed

create function public.rate_order(
  p_order_id uuid,
  p_stars integer,
  p_comment text default null
)
returns public.order_ratings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders;
  v_comment text := nullif(btrim(p_comment, E' \t\n\r'), '');
  v_rating public.order_ratings;
begin
  select * into v_order from public.orders where id = p_order_id;

  -- Same answer whether the order is missing or simply not yours.
  if not found or v_user is null or v_order.customer_id <> v_user then
    raise exception 'order_not_found' using errcode = '42501';
  end if;

  if v_order.status <> 'collected' then
    raise exception 'order_not_collected'
      using detail = 'Only a collected order can be rated.';
  end if;

  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'invalid_stars' using detail = 'Stars go from 1 to 5.';
  end if;

  if char_length(v_comment) > 500 then
    raise exception 'comment_too_long' using detail = 'A comment is at most 500 characters.';
  end if;

  -- "Only once": if a rating exists (or another request is saving one right
  -- now), this inserts nothing, and the first rating stays as it is.
  insert into public.order_ratings (order_id, customer_id, truck_id, stars, comment, rated_at)
  values (v_order.id, v_order.customer_id, v_order.truck_id, p_stars, v_comment, private.clock_now())
  on conflict (order_id) do nothing
  returning * into v_rating;

  if not found then
    raise exception 'already_rated' using detail = 'This order already has a rating.';
  end if;

  return v_rating;
end;
$$;

revoke all on function public.rate_order(uuid, integer, text) from public, anon;
grant execute on function public.rate_order(uuid, integer, text) to authenticated;
