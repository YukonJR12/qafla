-- Qafla Pickup · Live order updates
--
-- Supabase Realtime tells a browser about a change only for tables listed
-- in the `supabase_realtime` publication. This adds `orders` to it, so:
--   * the vendor board hears about a new order or a status change, and
--   * the customer's open ticket hears when the truck marks it ready.
--
-- Nothing about who may READ an order changes. Realtime checks the same
-- row-level security rule (orders_select) for every listener before it
-- sends a change: the customer who placed it, the vendor of its truck, and
-- the manager. Nobody else is told anything.
--
-- order_items is deliberately left out. An order's lines never change after
-- it is placed, so the screens re-read them with the order.
--
-- A plain Postgres database (the local test database before its shim) has
-- no such publication; then there is nothing to do.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
