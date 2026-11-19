-- Qafla Pickup · 4 · Placing an order is safe to retry
--
-- The problem: a customer taps "Place order", the order is saved, but the
-- answer never reaches their phone (bad signal). They tap again. Without
-- this migration that makes a second order and takes a second place.
--
-- The fix: every confirmed checkout attempt carries a request ID made by
-- the browser. The database remembers it on the order. Sending the same
-- attempt again returns the order that already exists.

-- ---------------------------------------------------------------------------
-- 1. Remember the request ID on the order
-- ---------------------------------------------------------------------------

-- Orders placed before this migration keep NULL here and are untouched.
alter table public.orders add column client_request_id uuid;

-- One order per customer per request ID. This is the rule that holds even
-- if two copies of the same request arrive at the same moment. NULLs are
-- never equal to each other, so the old orders do not collide.
create unique index orders_customer_request_key
  on public.orders (customer_id, client_request_id);

-- ---------------------------------------------------------------------------
-- 2. "Have I already saved this attempt?"
-- ---------------------------------------------------------------------------
-- Returns the order saved for this customer and request ID, or an empty row
-- if there is none. If the ID was used before for a DIFFERENT order (another
-- truck, time or cart), it refuses: one ID means one order.

create function private.order_for_request(
  p_customer uuid,
  p_request_id uuid,
  p_truck_id text,
  p_slot_start time,
  p_items jsonb
)
returns public.orders
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order
  from public.orders o
  where o.customer_id = p_customer
    and o.client_request_id = p_request_id;

  if not found then
    return null;
  end if;

  if v_order.truck_id is distinct from p_truck_id
     or v_order.slot_start is distinct from p_slot_start
     -- The same dishes in the same quantities, in any order.
     or (
       select jsonb_agg(
                jsonb_build_object('item_id', i.item_id, 'quantity', i.quantity)
                order by i.item_id
              )
       from public.order_items i
       where i.order_id = v_order.id
     ) is distinct from (
       select jsonb_agg(
                jsonb_build_object('item_id', e ->> 'item_id', 'quantity', (e ->> 'quantity')::integer)
                order by e ->> 'item_id'
              )
       from jsonb_array_elements(p_items) as e
     ) then
    raise exception 'request_id_reused'
      using detail = 'This request ID already belongs to a different order.';
  end if;

  return v_order;
end;
$$;

revoke all on function private.order_for_request(uuid, uuid, text, time, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. place_order now takes the request ID
-- ---------------------------------------------------------------------------
-- The three-argument version is removed so that no caller can place an
-- order without a request ID. Everything below is the same function as
-- before, plus the lines marked NEW.

drop function public.place_order(text, time, jsonb);

create function public.place_order(
  p_truck_id text,
  p_slot_start time,
  p_items jsonb,
  p_request_id uuid
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

  -- NEW: every attempt must say which attempt it is.
  if p_request_id is null then
    raise exception 'request_id_required'
      using detail = 'Send a request ID so a retry cannot place a second order.';
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

  -- NEW: a retry of an attempt that was already saved gets the same order
  -- back. This happens BEFORE the truck, time and slot checks on purpose:
  -- the order exists, so it does not matter that the slot has since filled
  -- or the truck has since closed.
  v_order := private.order_for_request(v_customer, p_request_id, p_truck_id, p_slot_start, p_items);
  if v_order.id is not null then
    return v_order;
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

  -- NEW: look again now that the lock is ours. If an identical request was
  -- running at the same moment, it held this lock, saved the order and
  -- finished while we waited. We return its order instead of making another.
  v_order := private.order_for_request(v_customer, p_request_id, p_truck_id, p_slot_start, p_items);
  if v_order.id is not null then
    return v_order;
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
  begin
    insert into public.orders (
      ticket_ref, customer_id, truck_id, service_date, slot_start,
      total_kwd, placed_at, updated_at, client_request_id
    )
    select
      p_truck_id || '-' || lpad(nextval('private.order_ticket_seq')::text, 6, '0'),
      v_customer,
      p_truck_id,
      v_today,
      p_slot_start,
      sum((c ->> 'quantity')::integer * (c ->> 'price')::numeric),
      private.clock_now(),
      private.clock_now(),
      p_request_id
    from jsonb_array_elements(v_cart) as c
    returning * into v_order;
  exception
    -- NEW: the last line of defence. Two requests with the same ID but
    -- DIFFERENT trucks lock different rows, so neither waits for the other.
    -- The unique index lets only one of them save; the other lands here.
    when unique_violation then
      raise exception 'request_id_reused'
        using detail = 'This request ID already belongs to a different order.';
  end;

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

revoke all on function public.place_order(text, time, jsonb, uuid) from public, anon;
grant execute on function public.place_order(text, time, jsonb, uuid) to authenticated;
