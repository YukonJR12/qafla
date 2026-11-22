-- Forecast reads the same orders that power occupancy. No customer data leaves this RPC.
alter table public.orders add column if not exists fixture_batch text;
create index if not exists orders_service_date_idx on public.orders (service_date);

create or replace function public.forecast_history()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  as_of timestamptz := private.clock_now();
  today date := (as_of at time zone 'Asia/Kuwait')::date;
  result jsonb;
begin
  if not coalesce(private.is_manager(), false) then
    raise exception 'manager_only' using errcode = '42501';
  end if;
  with dates as (
    select generate_series(
      greatest(today - 56, coalesce((select min(service_date) from public.orders), today)),
      today, interval '1 day')::date as d
  ), rows as (
    select d, t.id, s.slot, t.slot_capacity,
      case when d = today and not t.is_open then 0
        when c.closed_at is not null then extract(epoch from ((c.closed_at at time zone 'Asia/Kuwait') - d::timestamp)) / 60
      end as closed_at,
      coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'madeAt', extract(epoch from ((o.placed_at at time zone 'Asia/Kuwait') - d::timestamp)) / 60,
        'removedAt', case when o.status in ('cancelled','rejected') then extract(epoch from ((o.updated_at at time zone 'Asia/Kuwait') - d::timestamp)) / 60 end,
        'removedStatus', case when o.status in ('cancelled','rejected') then o.status::text end
      )) order by o.placed_at, o.id)
        from public.orders o where o.service_date = d and o.truck_id = t.id and o.slot_start = s.slot
        and o.placed_at <= as_of), '[]'::jsonb) as bookings
    from dates cross join public.trucks t
    cross join lateral (select (time '17:00' + n * interval '15 minutes')::time as slot from generate_series(0,23) n) s
    left join public.truck_closures c on c.truck_id = t.id and c.service_date = d
  )
  select jsonb_build_object(
    'serviceDate', today, 'now', extract(epoch from (as_of at time zone 'Asia/Kuwait')::time) / 60,
    'history', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'day', d - date '1970-01-04', 'serviceDate', d, 'truck', id, 'slot', slot,
      'capacity', slot_capacity, 'closedAt', closed_at, 'bookings', bookings
    )) order by d, id, slot), '[]'::jsonb)
  ) into result from rows;
  return result;
end;
$$;
revoke all on function public.forecast_history() from public, anon, authenticated;
grant execute on function public.forecast_history() to authenticated;
