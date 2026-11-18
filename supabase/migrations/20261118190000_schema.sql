-- Qafla Pickup · 1 of 3 · Tables
--
-- What is stored, and the rules a single row must obey (constraints).
-- Who may read or write each table is in the next migration.
-- How an order is placed and moved is in the third.

-- Helpers that the API must not expose live here. Supabase only exposes
-- the `public` schema, so nothing in `private` can be called from a browser.
create schema if not exists private;

create type public.user_role as enum ('customer', 'vendor', 'manager');

create type public.order_status as enum (
  'placed', 'accepted', 'preparing', 'ready', 'collected',
  'rejected', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- One row per signed-in account. Supabase Auth owns auth.users; this table
-- holds the one thing the app adds: the role.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  display_name text,
  created_at timestamptz not null default now()
);

-- Runs when Supabase Auth creates an account. A signup may ask for
-- 'customer' or 'vendor'. Anything else, including 'manager', becomes
-- 'customer'. The manager role is only ever set by SQL run by the database
-- owner (see README).
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    case
      when new.raw_user_meta_data ->> 'role' = 'vendor'
        then 'vendor'::public.user_role
      else 'customer'::public.user_role
    end,
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Trucks and menus (IDs, names and prices come from seed/*.csv)
-- ---------------------------------------------------------------------------

create table public.trucks (
  id text primary key,                       -- 'T02'
  name text not null,
  cuisine text not null,
  blurb text not null default '',
  -- Most orders one 15-minute slot can take. Starts from
  -- default_slot_capacity in seed/trucks.csv.
  slot_capacity integer not null check (slot_capacity between 1 and 20),
  -- The vendor's own open/closed switch.
  is_open boolean not null default true,
  -- The one vendor who runs this truck. `unique` means one truck per vendor.
  vendor_id uuid unique references public.profiles (id) on delete set null
);

create table public.menu_items (
  id text primary key,                       -- 'M201'
  truck_id text not null references public.trucks (id),
  name text not null,
  category text not null,
  -- Kuwaiti dinars, always 3 decimals. numeric is exact; float is not.
  price_kwd numeric(10, 3) not null check (price_kwd >= 0),
  description text,
  sold_out boolean not null default false
);

create index menu_items_truck_idx on public.menu_items (truck_id);

-- The park manager closing a truck "for tonight". One row per truck per
-- Kuwait service date, so a closure expires by itself the next day and the
-- vendor's own is_open switch cannot undo it.
create table public.truck_closures (
  truck_id text not null references public.trucks (id),
  service_date date not null,
  closed_by uuid not null references public.profiles (id),
  closed_at timestamptz not null,
  primary key (truck_id, service_date)
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create sequence private.order_ticket_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- What the customer reads out at the counter, e.g. 'T02-000042'.
  ticket_ref text not null unique,
  customer_id uuid not null references public.profiles (id),
  truck_id text not null references public.trucks (id),
  -- The Kuwait calendar date and the slot's start time on that date.
  -- Both are filled in by the server, never by the browser.
  service_date date not null,
  slot_start time not null,
  status public.order_status not null default 'placed',
  -- Online payment is a later milestone and will widen this check.
  payment_method text not null default 'pay_at_pickup'
    check (payment_method = 'pay_at_pickup'),
  -- Sum of quantity x unit price, worked out by the server when placed.
  total_kwd numeric(10, 3) not null check (total_kwd >= 0),
  rejection_reason text,
  placed_at timestamptz not null,
  updated_at timestamptz not null,

  -- 24 slots: 5:00 PM to 10:45 PM, exactly on the quarter hour.
  -- extract(epoch ...) is an exact decimal number of seconds, so
  -- 19:14:59.999999 is refused. Casting it to integer would round it to
  -- 19:15:00 and let it through.
  constraint orders_slot_on_grid check (
    slot_start between time '17:00' and time '22:45'
    and extract(epoch from slot_start) % 900 = 0
  ),
  -- A rejected order must carry a real reason: not missing, and with at
  -- least one character that is not whitespace ('\S'), so spaces, tabs and
  -- newlines alone do not count. The `is not null` matters: without it a
  -- missing reason makes the check "unknown", and Postgres lets "unknown"
  -- pass.
  constraint orders_rejection_has_reason check (
    status <> 'rejected'
    or (rejection_reason is not null and rejection_reason ~ '\S')
  )
);

-- There is deliberately no "places left" column anywhere. A slot's free
-- places are counted from this table every time (see place_order and
-- slot_usage). This index makes that count fast.
create index orders_slot_idx
  on public.orders (truck_id, service_date, slot_start);
create index orders_customer_idx on public.orders (customer_id);

create table public.order_items (
  order_id uuid not null references public.orders (id) on delete cascade,
  item_id text not null references public.menu_items (id),
  -- Name and price are copied from the menu when the order is placed, so
  -- a later menu edit never changes an order that already exists.
  item_name text not null,
  quantity integer not null check (quantity between 1 and 10),
  unit_price_kwd numeric(10, 3) not null check (unit_price_kwd >= 0),
  primary key (order_id, item_id)
);
