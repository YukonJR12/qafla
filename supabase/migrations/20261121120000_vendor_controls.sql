-- Qafla Pickup · The vendor's own controls: truck details, open or closed,
-- dish prices and the sold-out switch
--
-- Nothing new is granted here. Since the first migrations a signed-in user
-- has been allowed to update a few named columns (trucks: name, cuisine,
-- blurb, slot_capacity, is_open; menu_items: name, category, price_kwd,
-- description, sold_out), and row-level security has limited that to the
-- truck's own assigned vendor. The app now has screens that use those
-- rights, so this migration adds the limits a typed value needs.
--
-- Adds only. No row is changed and no order is touched.

-- ---------------------------------------------------------------------------
-- Truck details: short, single-line text
-- ---------------------------------------------------------------------------
-- `btrim(x) = x` refuses leading or trailing spaces, so "  " cannot be a
-- name. `[[:cntrl:]]` is any control character (new line, tab), which would
-- break the one-line layouts these values are printed in.

alter table public.trucks
  add constraint trucks_name_ok check (
    name = btrim(name)
    and char_length(name) between 1 and 40
    and name !~ '[[:cntrl:]]'
  ),
  add constraint trucks_cuisine_ok check (
    cuisine = btrim(cuisine)
    and char_length(cuisine) between 1 and 30
    and cuisine !~ '[[:cntrl:]]'
  ),
  add constraint trucks_blurb_ok check (
    blurb = btrim(blurb)
    and char_length(blurb) <= 120
    and blurb !~ '[[:cntrl:]]'
  );

-- ---------------------------------------------------------------------------
-- Dish prices: more than zero, less than 1000 KWD
-- ---------------------------------------------------------------------------
-- The column is numeric(10, 3), so Postgres already keeps exactly three
-- decimals: 1.9999 would be stored as 2.000. The old check allowed 0, which
-- would put a free dish on the menu. Dana's first rule is that nobody gets
-- food for less than the menu price, so a menu price has to be a real one.

alter table public.menu_items
  add constraint menu_items_price_real check (price_kwd > 0 and price_kwd < 1000);

-- ---------------------------------------------------------------------------
-- The two closed states, for the record
-- ---------------------------------------------------------------------------
-- trucks.is_open          the VENDOR's switch. It stays as set until the
--                         vendor changes it.
-- truck_closures          the PARK MANAGER's "Close for tonight". One row
--                         per truck and Kuwait service date, written only
--                         by close_truck_for_tonight().
--
-- place_order refuses a new order when EITHER says closed, so a vendor who
-- switches is_open back on cannot undo the manager's closure. Neither one
-- touches an order that already exists: set_order_status never looks at
-- them, so the kitchen can always finish tonight's tickets.

comment on column public.trucks.is_open is
  'The vendor''s own switch. The park manager''s closure for tonight lives in truck_closures and wins over this.';
