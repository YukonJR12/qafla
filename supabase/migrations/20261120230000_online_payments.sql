-- Qafla Pickup · Online payment (test mode)
--
-- The brief: "Customers pay online or at pickup. An online order counts as
-- paid only after the app's server has confirmed the payment with the
-- gateway. If a vendor rejects a paid order, the order shows Refund due."
--
-- How it fits together:
--   1. The customer places the order exactly as before (place_order). It
--      takes its pickup place straight away. For "Pay online" the order is
--      marked payment_method = 'online' in the same transaction.
--   2. Our server asks the gateway for a payment page for that order's
--      saved total and records the gateway's invoice ID here.
--   3. After the customer pays (or not), our server asks the gateway what
--      happened and passes the gateway's answer to settle_payment(). The
--      DATABASE compares it with the saved order: same invoice, same
--      amount, KWD, and the order's own ID. Only then is the order "paid".
--
-- A forward migration. It adds columns, one table, one small private table
-- and functions. place_order, set_order_status and every access rule stay
-- as they are; no existing order is changed (they all stay pay-at-pickup
-- and unpaid).

-- ---------------------------------------------------------------------------
-- 1. Payment on the order
-- ---------------------------------------------------------------------------

alter table public.orders drop constraint orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
    check (payment_method in ('pay_at_pickup', 'online'));

alter table public.orders
  -- 'unpaid'      nothing confirmed (every pay-at-pickup order, and an
  --               online order before the gateway confirms it)
  -- 'paid'        the gateway confirmed a payment that matches this order
  -- 'refund_due'  it was paid, and then rejected or cancelled
  add column payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refund_due')),
  add column paid_at timestamptz,
  -- Only an online order can be paid here; pay-at-pickup money is taken at
  -- the counter and is not recorded by the app.
  add constraint orders_paid_only_online
    check (payment_status = 'unpaid' or payment_method = 'online');

-- ---------------------------------------------------------------------------
-- 2. One row per payment page the gateway made for an order
-- ---------------------------------------------------------------------------

create table public.order_payments (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  customer_id uuid not null references public.profiles (id),
  -- The gateway's own invoice number. One invoice belongs to one order.
  invoice_id text not null unique,
  -- What we asked the gateway to charge: the order's saved total.
  amount_kwd numeric(10, 3) not null check (amount_kwd > 0),
  currency text not null default 'KWD' check (currency = 'KWD'),
  -- Where the customer pays. Reused if they tap "Pay" again soon after.
  payment_url text not null,
  -- 'created'    waiting for the customer or the bank
  -- 'paid'       confirmed and matching
  -- 'failed'     the gateway says it failed
  -- 'cancelled'  the gateway says it was cancelled
  -- 'mismatch'   the gateway says paid, but it does not match the order
  -- 'duplicate'  a second confirmed payment for an order that is already paid
  status text not null default 'created'
    check (status in ('created', 'paid', 'failed', 'cancelled', 'mismatch', 'duplicate')),
  -- The gateway's ID for the payment attempt, once we have seen one.
  gateway_payment_id text,
  gateway_status text,
  created_at timestamptz not null,
  settled_at timestamptz
);

create index order_payments_order_idx on public.order_payments (order_id, created_at);

-- An order can be paid once.
create unique index order_payments_one_paid_per_order
  on public.order_payments (order_id) where status = 'paid';

-- Nobody writes this table through the API. The customer can read their
-- own rows; the manager can read all of them.
revoke all on public.order_payments from anon, authenticated;
grant select on public.order_payments to authenticated;
alter table public.order_payments enable row level security;

create policy order_payments_select on public.order_payments
  for select to authenticated
  using (customer_id = (select auth.uid()) or (select private.is_manager()));

-- ---------------------------------------------------------------------------
-- 3. How the database knows a call really comes from our server
-- ---------------------------------------------------------------------------
-- The two functions that record gateway facts must not be callable by a
-- customer from their browser: otherwise a customer could say "I paid".
-- Our server holds a long random secret (PAYMENTS_SERVER_SECRET) and sends
-- it with those two calls. The database stores only a SHA-256 hash of it,
-- so reading this table does not reveal the secret. With no row here,
-- nothing can be recorded at all.

create table private.server_keys (
  name text primary key,
  secret_hash text not null
);
revoke all on private.server_keys from public, anon, authenticated;

create function private.is_payments_server(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_secret is not null and length(p_secret) >= 32 and exists (
    select 1 from private.server_keys k
    where k.name = 'payments'
      and k.secret_hash = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')
  );
$$;
revoke all on function private.is_payments_server(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Rules that follow the order's status
-- ---------------------------------------------------------------------------
-- (a) A truck cannot accept an online order that has not been paid: that
--     is the point of paying first ("so trucks stop cooking for people who
--     never turn up"). It can still reject it.
-- (b) A paid order that is rejected or cancelled becomes "Refund due".
-- A trigger is used so set_order_status itself does not have to change.

create function private.orders_payment_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'accepted' and new.payment_method = 'online' and new.payment_status = 'unpaid' then
      raise exception 'payment_not_confirmed'
        using detail = 'This order is to be paid online and has not been paid yet.';
    end if;
    if new.status in ('rejected', 'cancelled') and new.payment_status = 'paid' then
      new.payment_status := 'refund_due';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.orders_payment_rules() from public, anon, authenticated;

create trigger orders_payment_rules
  before update on public.orders
  for each row execute function private.orders_payment_rules();

-- ---------------------------------------------------------------------------
-- 5. place_order_paying: place the order and say how it will be paid
-- ---------------------------------------------------------------------------
-- A thin wrapper. Every rule (who, cart, slot, lock, price, retry) is still
-- place_order's. This only records the payment choice, in the same
-- transaction, so the kitchen never sees an online order as pay-at-pickup.
-- A retry with the same request ID returns the order already saved, with
-- the payment method it was saved with.
--
-- Extra error: invalid_payment_method

create function public.place_order_paying(
  p_truck_id text,
  p_slot_start time,
  p_items jsonb,
  p_request_id uuid,
  p_payment_method text
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if p_payment_method is null or p_payment_method not in ('pay_at_pickup', 'online') then
    raise exception 'invalid_payment_method' using detail = 'Choose pay_at_pickup or online.';
  end if;

  v_order := public.place_order(p_truck_id, p_slot_start, p_items, p_request_id);

  -- Switch it only while the truck has not touched it and no payment page
  -- exists for it. (On a retry that asks for "online" after a lost first
  -- answer, this is the customer's own waiting order, so their latest
  -- choice is used.)
  if p_payment_method = 'online'
     and v_order.payment_method = 'pay_at_pickup'
     and v_order.payment_status = 'unpaid'
     and v_order.status = 'placed'
     and not exists (select 1 from public.order_payments p where p.order_id = v_order.id) then
    update public.orders set payment_method = 'online'
    where id = v_order.id and customer_id = auth.uid()
    returning * into v_order;
  end if;

  return v_order;
end;
$$;

revoke all on function public.place_order_paying(text, time, jsonb, uuid, text) from public, anon;
grant execute on function public.place_order_paying(text, time, jsonb, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. begin_online_payment: "I want to pay for this order now"
-- ---------------------------------------------------------------------------
-- Called by our server AS the signed-in customer. It answers with the
-- amount to charge, read from the saved order (never from the page), and
-- with a payment page made in the last 20 minutes if there is one, so
-- tapping "Pay" twice does not make two invoices.
--
-- Errors:
--   order_not_found     not your order (or no such order)
--   not_online_order    this order is pay-at-pickup
--   already_paid        it is paid (or a refund is due)
--   order_not_payable   it was rejected or cancelled

create function public.begin_online_payment(p_order_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders;
  v_open public.order_payments;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_user is null or v_order.customer_id <> v_user then
    raise exception 'order_not_found' using errcode = '42501';
  end if;
  if v_order.payment_method <> 'online' then
    raise exception 'not_online_order';
  end if;
  if v_order.payment_status <> 'unpaid' then
    raise exception 'already_paid';
  end if;
  if v_order.status in ('rejected', 'cancelled') then
    raise exception 'order_not_payable';
  end if;

  select * into v_open from public.order_payments
  where order_id = v_order.id and status = 'created'
    and created_at > private.clock_now() - interval '20 minutes'
  order by created_at desc limit 1;

  return json_build_object(
    'order_id', v_order.id,
    'ticket_ref', v_order.ticket_ref,
    'amount_kwd', v_order.total_kwd,
    'currency', 'KWD',
    'open_invoice_id', v_open.invoice_id,
    'open_payment_url', v_open.payment_url
  );
end;
$$;

revoke all on function public.begin_online_payment(uuid) from public, anon;
grant execute on function public.begin_online_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. record_payment_page: remember the invoice before the customer leaves
-- ---------------------------------------------------------------------------
-- Server only (needs the server secret). The amount stored is read from
-- the order again here, not taken from the caller.

create function public.record_payment_page(
  p_secret text,
  p_order_id uuid,
  p_invoice_id text,
  p_payment_url text
)
returns public.order_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_row public.order_payments;
begin
  if not private.is_payments_server(p_secret) then
    raise exception 'not_the_server' using errcode = '42501';
  end if;
  if p_invoice_id is null or p_invoice_id !~ '\S' or p_payment_url is null or p_payment_url !~ '^https://' then
    raise exception 'invalid_invoice';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.payment_method <> 'online' or v_order.payment_status <> 'unpaid'
     or v_order.status in ('rejected', 'cancelled') then
    raise exception 'order_not_payable';
  end if;

  insert into public.order_payments (order_id, customer_id, invoice_id, amount_kwd, payment_url, created_at)
  values (v_order.id, v_order.customer_id, p_invoice_id, v_order.total_kwd, p_payment_url, private.clock_now())
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. settle_payment: the gateway's answer, checked against the order
-- ---------------------------------------------------------------------------
-- Server only. The server passes on what the GATEWAY said about one
-- invoice. This function decides what that means:
--
--   paid       the gateway says the invoice is PAID and the transaction
--              SUCCESS, the currency is KWD, the amount equals the saved
--              order total, and the order ID the gateway holds is this
--              order's ID. The order becomes 'paid' (or 'refund_due' if it
--              was already rejected or cancelled).
--   mismatch   the gateway says paid, but something does not match. The
--              order is NOT marked paid.
--   failed / cancelled   the gateway says this try failed. The order stays
--              unpaid. A later successful try on the same invoice can still
--              mark it paid.
--   (pending)  anything else. Nothing changes.
--
-- Safe to call any number of times with the same answer: a payment that is
-- already settled is returned as it is, and an order can be paid once.
--
-- Errors: not_the_server, unknown_invoice

create function public.settle_payment(
  p_secret text,
  p_invoice_id text,
  p_gateway_payment_id text,
  p_invoice_status text,
  p_transaction_status text,
  p_amount numeric,
  p_currency text,
  p_external_identifier text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := private.clock_now();
  v_row public.order_payments;
  v_order public.orders;
  v_invoice text := upper(coalesce(p_invoice_status, ''));
  v_txn text := upper(coalesce(p_transaction_status, ''));
  v_outcome text;
begin
  if not private.is_payments_server(p_secret) then
    raise exception 'not_the_server' using errcode = '42501';
  end if;

  select * into v_row from public.order_payments where invoice_id = p_invoice_id;
  if not found then
    raise exception 'unknown_invoice';
  end if;

  -- One settlement at a time per order.
  select * into v_order from public.orders where id = v_row.order_id for update;
  select * into v_row from public.order_payments where id = v_row.id for update;

  -- Already decided for good: answer the same way again, change nothing.
  -- ('failed' and 'cancelled' are not final: one invoice can be tried
  -- several times at the gateway, and a later try may succeed.)
  if v_row.status in ('paid', 'duplicate', 'mismatch') then
    return json_build_object('order_id', v_order.id, 'payment', v_row.status,
                             'payment_status', v_order.payment_status, 'changed', false);
  end if;

  if v_invoice = 'PAID' and v_txn = 'SUCCESS' then
    if upper(coalesce(p_currency, '')) = 'KWD'
       and p_amount is not null
       and p_amount = v_row.amount_kwd
       and p_amount = v_order.total_kwd
       and p_external_identifier = v_order.id::text then
      -- A second matching payment for an order that is already paid.
      if v_order.payment_status <> 'unpaid' then
        v_outcome := 'duplicate';
      else
        v_outcome := 'paid';
      end if;
    else
      v_outcome := 'mismatch';
    end if;
  elsif v_txn = 'FAILED' then
    v_outcome := 'failed';
  elsif v_txn in ('CANCELED', 'CANCELLED') or v_invoice in ('CANCELED', 'CANCELLED') then
    v_outcome := 'cancelled';
  else
    -- Still pending: nothing is decided. What we already know stays as it is.
    return json_build_object('order_id', v_order.id, 'payment', v_row.status,
                             'payment_status', v_order.payment_status, 'changed', false);
  end if;

  -- The same answer as last time (a reload, a repeated notification).
  if v_outcome = v_row.status then
    return json_build_object('order_id', v_order.id, 'payment', v_row.status,
                             'payment_status', v_order.payment_status, 'changed', false);
  end if;

  update public.order_payments
  set status = v_outcome,
      gateway_payment_id = coalesce(p_gateway_payment_id, gateway_payment_id),
      gateway_status = v_invoice || '/' || v_txn,
      settled_at = v_now
  where id = v_row.id;

  if v_outcome = 'paid' then
    update public.orders
    set payment_status = case when status in ('rejected', 'cancelled') then 'refund_due' else 'paid' end,
        paid_at = v_now,
        updated_at = v_now
    where id = v_order.id
    returning * into v_order;
  end if;

  return json_build_object('order_id', v_order.id, 'payment', v_outcome,
                           'payment_status', v_order.payment_status, 'changed', true);
end;
$$;

-- These two check the server secret themselves. A caller without it gets
-- 'not_the_server', whoever they are signed in as.
revoke all on function public.record_payment_page(text, uuid, text, text) from public;
revoke all on function public.settle_payment(text, text, text, text, text, numeric, text, text) from public;
grant execute on function public.record_payment_page(text, uuid, text, text) to anon, authenticated;
grant execute on function public.settle_payment(text, text, text, text, text, numeric, text, text) to anon, authenticated;
