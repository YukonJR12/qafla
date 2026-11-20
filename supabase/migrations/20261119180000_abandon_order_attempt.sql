-- Qafla Pickup · 5 · Giving up on an attempt whose answer never arrived
--
-- The problem: a customer taps "Place order" and hears nothing back. The
-- app asks "was my order saved?" and the answer is "no order". That does
-- NOT prove the attempt failed: the request may still be on its way, or
-- waiting in line behind another order. If the app unlocked the cart now
-- and the customer ordered again, the late request could still land and
-- make a second order.
--
-- The fix: the customer can abandon the attempt, and the database decides
-- the race. Placing and abandoning the same request ID take the same lock,
-- so exactly one of them wins:
--   - the order was saved first  -> abandoning returns that order's ticket
--   - abandoning was saved first -> the late request is refused for good
-- Only after the database has answered does the app unlock the cart.

-- ---------------------------------------------------------------------------
-- 1. Remember abandoned attempts
-- ---------------------------------------------------------------------------
-- In the private schema: the app never reads this table directly.

create table private.abandoned_requests (
  customer_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid not null,
  abandoned_at timestamptz not null default now(),
  primary key (customer_id, request_id)
);

revoke all on private.abandoned_requests from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The lock that "place" and "abandon" share
-- ---------------------------------------------------------------------------
-- An advisory lock is a lock on a number instead of on a row. The number is
-- made from the customer and the request ID, so it only ever makes two
-- transactions wait if they are about the same attempt. It is released
-- automatically when the transaction commits or rolls back.

create function private.lock_request(p_customer uuid, p_request_id uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_customer::text || ':' || p_request_id::text, 0)
  );
$$;

revoke all on function private.lock_request(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. "I give up on this attempt"
-- ---------------------------------------------------------------------------
-- Returns the order if the attempt was in fact saved (the customer gets
-- their ticket). Otherwise records that the attempt is abandoned and
-- returns an empty row: from then on place_order refuses that request ID.
-- Safe to call more than once.

create function public.abandon_order_attempt(p_request_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := auth.uid();
  v_order public.orders;
begin
  perform private.require_read_committed();

  if v_customer is null
     or private.my_role() is distinct from 'customer'::public.user_role then
    raise exception 'not_a_customer'
      using errcode = '42501', detail = 'Only signed-in customers have checkout attempts.';
  end if;

  if p_request_id is null then
    raise exception 'request_id_required';
  end if;

  -- Wait here if the original request is being placed right now. When the
  -- lock is ours, that request has either saved its order or failed.
  perform private.lock_request(v_customer, p_request_id);

  select * into v_order
  from public.orders o
  where o.customer_id = v_customer
    and o.client_request_id = p_request_id;

  if found then
    return v_order;          -- placing won: here is the ticket
  end if;

  insert into private.abandoned_requests (customer_id, request_id)
  values (v_customer, p_request_id)
  on conflict do nothing;    -- abandoning it twice is the same as once

  return null;               -- abandoning won: nothing was or will be placed
end;
$$;

revoke all on function public.abandon_order_attempt(uuid) from public, anon;
grant execute on function public.abandon_order_attempt(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. place_order takes the same lock and respects an abandoned attempt
-- ---------------------------------------------------------------------------
-- Same function as before, plus the two blocks marked NEW. The truck-row
-- lock and every check after it are unchanged.

create or replace function public.place_order(
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

  -- Every attempt must say which attempt it is.
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

  -- NEW: one at a time per attempt. Everything that decides the fate of this
  -- customer's request ID (placing it, or abandoning it) takes this lock
  -- first and keeps it until its transaction ends. So "place" and "abandon"
  -- can never both win: whichever gets here second sees what the first did.
  perform private.lock_request(v_customer, p_request_id);

  -- A retry of an attempt that was already saved gets the same order
  -- back. This happens BEFORE the truck, time and slot checks on purpose:
  -- the order exists, so it does not matter that the slot has since filled
  -- or the truck has since closed.
  v_order := private.order_for_request(v_customer, p_request_id, p_truck_id, p_slot_start, p_items);
  if v_order.id is not null then
    return v_order;
  end if;

  -- NEW: the customer gave up on this attempt and was told nothing was
  -- placed. A copy of the request that arrives late must not place it now.
  if exists (
    select 1 from private.abandoned_requests a
    where a.customer_id = v_customer and a.request_id = p_request_id
  ) then
    raise exception 'request_abandoned'
      using detail = 'This attempt was abandoned by the customer. Start a new one.';
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

  -- Look again now that the truck lock is ours. If an identical request was
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
    -- The last line of defence: the table itself allows one order per
    -- customer per request ID, whatever happened above.
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
