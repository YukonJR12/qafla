-- Qafla Pickup · 2 of 3 · Who can read and write what
--
-- Two layers, both needed:
--   1. GRANT  decides which tables and columns a role may touch at all.
--   2. RLS    decides which rows inside those tables.
-- Orders have no INSERT/UPDATE/DELETE grant, so the only way to create or
-- change one is through the functions in the next migration.

-- ---------------------------------------------------------------------------
-- "Who is asking?" helpers
-- ---------------------------------------------------------------------------
-- These read profiles/trucks with the owner's rights (security definer) so
-- that a policy on one table can ask about another without tripping over
-- that table's own policies.

create function private.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.my_role() = 'manager', false);
$$;

-- The truck this vendor runs, or null.
create function private.my_truck_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.trucks where vendor_id = (select auth.uid());
$$;

grant usage on schema private to anon, authenticated;
revoke all on all functions in schema private from public;
grant execute on function
  private.my_role(), private.is_manager(), private.my_truck_id()
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Layer 1: grants
-- ---------------------------------------------------------------------------
-- Supabase grants everything on new public tables to anon and authenticated
-- by default. Take it all back, then hand out only what is needed.

-- Only the tables these migrations created are named, so any other table
-- already in the project keeps whatever grants it had.
revoke all on
  public.profiles,
  public.trucks,
  public.menu_items,
  public.truck_closures,
  public.orders,
  public.order_items
  from anon, authenticated;

-- Anyone can browse trucks, menus and tonight's closures.
grant select on public.trucks, public.menu_items, public.truck_closures
  to anon, authenticated;

-- Signed-in users can read profiles and orders (RLS narrows the rows).
grant select on public.profiles, public.orders, public.order_items
  to authenticated;

-- A vendor may edit these columns only. vendor_id and id are not listed,
-- so a vendor cannot hand themselves another truck.
grant update (name, cuisine, blurb, slot_capacity, is_open)
  on public.trucks to authenticated;
grant update (name, category, price_kwd, description, sold_out)
  on public.menu_items to authenticated;

-- Nothing at all on profiles beyond SELECT: nobody can change their own
-- role through the API.

-- ---------------------------------------------------------------------------
-- Layer 2: row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.trucks enable row level security;
alter table public.menu_items enable row level security;
alter table public.truck_closures enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- profiles: you see yourself; the manager sees everyone.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_manager()));

-- trucks: public to read; only the assigned vendor edits their own row.
create policy trucks_select on public.trucks
  for select to anon, authenticated
  using (true);

create policy trucks_update_own on public.trucks
  for update to authenticated
  using (vendor_id = (select auth.uid()))
  with check (vendor_id = (select auth.uid()));

-- menu_items: public to read; a vendor edits only their own truck's dishes.
create policy menu_items_select on public.menu_items
  for select to anon, authenticated
  using (true);

create policy menu_items_update_own on public.menu_items
  for update to authenticated
  using (truck_id = (select private.my_truck_id()))
  with check (truck_id = (select private.my_truck_id()));

-- truck_closures: public to read (customers need to see "Closed for
-- tonight"). Written only by close_truck_for_tonight().
create policy truck_closures_select on public.truck_closures
  for select to anon, authenticated
  using (true);

-- orders: the customer who placed it, the vendor of its truck, the manager.
create policy orders_select on public.orders
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or truck_id = (select private.my_truck_id())
    or (select private.is_manager())
  );

-- order_items: visible exactly when the parent order is visible. The
-- sub-query runs under the orders policy above.
create policy order_items_select on public.order_items
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_items.order_id)
  );
