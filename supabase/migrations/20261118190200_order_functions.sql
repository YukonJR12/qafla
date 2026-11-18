-- Qafla Pickup · 3 of 3 · Placing, moving and closing
--
-- The browser never writes to orders directly. It calls one of these
-- functions (supabase.rpc). Each call runs as ONE database transaction:
-- either everything in it is saved, or an error undoes all of it.
--
-- Errors use a short, stable code as the message (e.g. 'slot_full') so the
-- app can show the right text in English or Arabic. The detail is for
-- developers.

-- ---------------------------------------------------------------------------
-- The clock
-- ---------------------------------------------------------------------------
-- Every rule about "now" and "today" reads the time here and nowhere else.
-- Only the database owner can replace this function; the test suite does so
-- to pin the time of day (tests/db/test-clock.sql). Production always gets
-- the real time.

create function private.clock_now()
returns timestamptz
language sql
as $$
  select clock_timestamp();
$$;

-- Kuwait wall-clock time (UTC+3, no daylight saving).
create function private.kuwait_now()
returns timestamp
language sql
set search_path = ''
as $$
  select private.clock_now() at time zone 'Asia/Kuwait';
$$;

-- The locking below relies on each statement seeing the newest committed
-- data (Postgres's default, READ COMMITTED). Refuse to run otherwise.
create function private.require_read_committed()
returns void
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'unsupported_isolation'
      using detail = 'Call this in a READ COMMITTED transaction.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- place_order
-- ---------------------------------------------------------------------------
-- p_items is the cart: [{"item_id": "M201", "quantity": 1}, ...]
-- Anything else the browser adds (a price, a total, a customer id, a date)
-- is never read.

create function public.place_order(
  p_truck_id text,
  p_slot_start time,
  p_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := auth.uid();
  v_truck public.trucks;
  v_now timestamp;          -- Kuwait wall clock
  v_today date;             -- Kuwait service date
  v_requested integer;
  v_cart jsonb;             -- the cart joined to the menu, read once
  v_booked integer;
  v_order public.orders;
begin
  perform private.require_read_committed();

  -- 1. Who is ordering? Taken from the sign-in token, not from the request.
  if v_customer is null
     or private.my_role() is distinct from 'customer'::public.user_role then
    raise exception 'not_a_customer'
      using errcode = '42501', detail = 'Only signed-in customers place orders.';
  end if;

  -- 2. Is the cart well formed? 1 to 10 of each item, whole numbers only.
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_cart' using detail = 'The cart is empty.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as e
    where jsonb_typeof(e -> 'item_id') is distinct from 'string'
       or jsonb_typeof(e -> 'quantity') is distinct from 'number'
       or not (
         case
           when (e ->> 'quantity') ~ '^[0-9]{1,2}$'
             then (e ->> 'quantity')::integer between 1 and 10
           else false
         end
       )
  ) then
    raise exception 'invalid_quantity'
      using detail = 'Each line needs an item_id and a whole quantity from 1 to 10.';
  end if;

  select count(*) into v_requested from jsonb_array_elements(p_items);

  if v_requested <> (
    select count(distinct e ->> 'item_id') from jsonb_array_elements(p_items) as e
  ) then
    raise exception 'duplicate_item'
      using detail = 'Each item may appear once in the cart.';
  end if;

  -- 3. Lock this truck's row. From here until the transaction ends, every
  --    other order for this truck, and any attempt to close it, waits in
  --    line. That is what keeps the checks below true until we save.
  select * into v_truck
  from public.trucks
  where id = p_truck_id
  for update;

  if not found then
    raise exception 'truck_not_found';
  end if;

  -- Read the clock only after the lock is ours: we may have waited for it.
  v_now := private.kuwait_now();
  v_today := v_now::date;

  -- 4. Is the truck taking orders? The vendor's switch and the manager's
  --    closure for tonight are both checked.
  if not v_truck.is_open
     or exists (
       select 1 from public.truck_closures c
       where c.truck_id = p_truck_id and c.service_date = v_today
     ) then
    raise exception 'truck_closed'
      using detail = 'This truck is not taking orders tonight.';
  end if;

  -- 5. Is the slot real, today, and at least 15 minutes away?
  if p_slot_start is null
     or p_slot_start < time '17:00'
     or p_slot_start > time '22:45'
     -- Exact decimal seconds, no rounding: 19:15:00.000001 is off the grid.
     or extract(epoch from p_slot_start) % 900 <> 0 then
    raise exception 'invalid_slot'
      using detail = 'Slots start every 15 minutes from 5:00 PM to 10:45 PM.';
  end if;

  if (v_today + p_slot_start) < v_now + interval '15 minutes' then
    raise exception 'slot_too_soon'
      using detail = 'Pick a slot that starts at least 15 minutes from now.';
  end if;

  -- 6. Read the menu ONCE for the whole cart. These are the prices the
  --    order keeps.
  select jsonb_agg(jsonb_build_object(
           'item_id', m.id,
           'name', m.name,
           'price', m.price_kwd,
           'sold_out', m.sold_out,
           'quantity', (e ->> 'quantity')::integer
         ))
  into v_cart
  from jsonb_array_elements(p_items) as e
  join public.menu_items m
    on m.id = e ->> 'item_id' and m.truck_id = p_truck_id;

  if coalesce(jsonb_array_length(v_cart), 0) <> v_requested then
    raise exception 'item_not_on_menu'
      using detail = 'Every item must be on this truck''s menu.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_cart) as c
    where (c ->> 'sold_out')::boolean
  ) then
    raise exception 'item_sold_out';
  end if;

  -- 7. Is there a place left? Counted from the orders themselves, never
  --    from a stored number. Rejected and cancelled orders do not count.
  select count(*) into v_booked
  from public.orders o
  where o.truck_id = p_truck_id
    and o.service_date = v_today
    and o.slot_start = p_slot_start
    and o.status not in ('rejected', 'cancelled');

  if v_booked >= v_truck.slot_capacity then
    raise exception 'slot_full'
      using detail = format('%s of %s places are taken.', v_booked, v_truck.slot_capacity);
  end if;

  -- 8. Save the order and its lines with the prices read in step 6.
  insert into public.orders (
    ticket_ref, customer_id, truck_id, service_date, slot_start,
    total_kwd, placed_at, updated_at
  )
  select
    p_truck_id || '-' || lpad(nextval('private.order_ticket_seq')::text, 6, '0'),
    v_customer,
    p_truck_id,
    v_today,
    p_slot_start,
    sum((c ->> 'quantity')::integer * (c ->> 'price')::numeric),
    private.clock_now(),
    private.clock_now()
  from jsonb_array_elements(v_cart) as c
  returning * into v_order;

  insert into public.order_items (order_id, item_id, item_name, quantity, unit_price_kwd)
  select
    v_order.id,
    c ->> 'item_id',
    c ->> 'name',
    (c ->> 'quantity')::integer,
    (c ->> 'price')::numeric
  from jsonb_array_elements(v_cart) as c;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_order_status
-- ---------------------------------------------------------------------------
-- The one-way order flow. Who may make each move:
--   placed -> accepted -> preparing -> ready -> collected   the truck's vendor
--   placed -> rejected (with a reason)                      the truck's vendor
--   placed -> cancelled                                     the customer

create function public.set_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_reason text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders;
  v_is_vendor boolean;
  v_is_customer boolean;
begin
  -- Lock the order so two people cannot move it at the same moment.
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  v_is_customer := found and v_order.customer_id = v_user;
  v_is_vendor := found and exists (
    select 1 from public.trucks t
    where t.id = v_order.truck_id and t.vendor_id = v_user
  );

  -- Same answer whether the order is missing or simply not yours, so
  -- nobody can discover other people's order ids.
  if not coalesce(v_is_customer or v_is_vendor, false) then
    raise exception 'order_not_found' using errcode = '42501';
  end if;

  if v_is_vendor and (v_order.status, p_status) in (
       ('placed', 'accepted'),
       ('accepted', 'preparing'),
       ('preparing', 'ready'),
       ('ready', 'collected')
     ) then
    null;  -- allowed
  elsif v_is_vendor and v_order.status = 'placed' and p_status = 'rejected' then
    -- '\S' = at least one character that is not whitespace.
    if p_reason is null or p_reason !~ '\S' then
      raise exception 'reason_required'
        using detail = 'A rejected order needs a reason.';
    end if;
  elsif v_is_customer and v_order.status = 'placed' and p_status = 'cancelled' then
    null;  -- allowed
  else
    raise exception 'transition_not_allowed'
      using detail = format('%s cannot go to %s for this user.', v_order.status, p_status);
  end if;

  update public.orders
  set status = p_status,
      rejection_reason = case when p_status = 'rejected' then btrim(p_reason, E' \t\n\r') end,
      updated_at = private.clock_now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- close_truck_for_tonight
-- ---------------------------------------------------------------------------
-- Park manager only. Stops new orders for today's Kuwait service date.
-- Existing orders are untouched: the vendor still cooks and hands them over.

create function public.close_truck_for_tonight(p_truck_id text)
returns public.truck_closures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager uuid := auth.uid();
  v_today date;
  v_closure public.truck_closures;
begin
  perform private.require_read_committed();

  if not private.is_manager() then
    raise exception 'not_a_manager' using errcode = '42501';
  end if;

  -- The same lock place_order takes. Whoever gets it first goes first;
  -- the other waits and then sees the result.
  perform 1 from public.trucks where id = p_truck_id for update;
  if not found then
    raise exception 'truck_not_found';
  end if;

  v_today := private.kuwait_now()::date;

  insert into public.truck_closures (truck_id, service_date, closed_by, closed_at)
  values (p_truck_id, v_today, v_manager, private.clock_now())
  on conflict (truck_id, service_date) do nothing;

  select * into v_closure
  from public.truck_closures
  where truck_id = p_truck_id and service_date = v_today;

  return v_closure;
end;
$$;

-- ---------------------------------------------------------------------------
-- slot_usage
-- ---------------------------------------------------------------------------
-- Tonight's 24 slots for one truck with how many places are taken. Customers
-- cannot read other people's orders, so this hands back counts only.

create function public.slot_usage(p_truck_id text)
returns table (slot_start time, booked integer, capacity integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.slot_start,
    (
      select count(*)::integer
      from public.orders o
      where o.truck_id = t.id
        and o.service_date = private.kuwait_now()::date
        and o.slot_start = s.slot_start
        and o.status not in ('rejected', 'cancelled')
    ) as booked,
    t.slot_capacity as capacity
  from public.trucks t
  cross join lateral (
    select time '17:00' + n * interval '15 minutes' as slot_start
    from generate_series(0, 23) as n
  ) as s
  where t.id = p_truck_id
  order by s.slot_start;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

revoke all on all functions in schema private from public;
grant execute on function
  private.my_role(), private.is_manager(), private.my_truck_id()
  to anon, authenticated;

revoke all on function
  public.place_order(text, time, jsonb),
  public.set_order_status(uuid, public.order_status, text),
  public.close_truck_for_tonight(text),
  public.slot_usage(text)
  from public, anon;

grant execute on function
  public.place_order(text, time, jsonb),
  public.set_order_status(uuid, public.order_status, text),
  public.close_truck_for_tonight(text)
  to authenticated;

grant execute on function public.slot_usage(text) to anon, authenticated;
