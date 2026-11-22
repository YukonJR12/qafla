// Owner-only, explicit fixture import. Dry-run by default; never invoked by the app.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { generateHistory } from '../lib/rush.ts';
const apply = process.argv.includes('--apply');
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
const batch = 'rush-demo-v1';
const id = value => {
  const s = createHash('sha256').update(`${batch}/${value}`).digest('hex');
  return `${s.slice(0,8)}-${s.slice(8,12)}-4${s.slice(13,16)}-a${s.slice(17,20)}-${s.slice(20,32)}`;
};
const customer = id('customer');
const stamp = (date, minute) => new Date(Date.parse(`${date}T00:00:00+03:00`) + minute * 60000).toISOString();
try {
  await db.connect();
  const clock = (await db.query("select (now() at time zone 'Asia/Kuwait')::date::text as today, extract(epoch from (now() at time zone 'Asia/Kuwait')::time)/60 as minute")).rows[0];
  const trucks = (await db.query('select id, slot_capacity, is_open from public.trucks order by id')).rows;
  const menu = (await db.query('select id, truck_id, name, price_kwd, sold_out from public.menu_items order by id')).rows;
  const existing = (await db.query("select truck_id, service_date::text as date, slot_start::text as slot, count(*) filter(where status not in ('cancelled','rejected'))::int as booked from public.orders group by truck_id,service_date,slot_start")).rows;
  const closures = (await db.query('select truck_id, service_date::text as date from public.truck_closures')).rows;
  const seededDates = new Set((await db.query('select distinct service_date::text as date from public.orders where customer_id=$1',[customer])).rows.map(r=>r.date));
  const manager = (await db.query("select id from public.profiles where role='manager' order by created_at limit 1")).rows[0]?.id;
  if (!manager) throw Error('manager_missing');
  const start = Date.parse(`${clock.today}T00:00:00Z`) - 56 * 86400000;
  const source = generateHistory(20261122,56,new Date(start).toISOString().slice(0,10));
  const orders = [], items = [], pastClosures = new Map();
  function add(date, truck, slot, position, madeAt, removedAt, historic) {
    const dishes = menu.filter(m=>m.truck_id===truck && (historic || !m.sold_out));
    if (!dishes.length) return;
    const dish = dishes[position % dishes.length], quantity = position % 4 === 0 ? 2 : 1;
    const orderId = id(`${date}/${truck}/${slot}/${position}`);
    const placed = stamp(date,madeAt);
    orders.push({id:orderId, customer_id:customer, truck_id:truck, service_date:date, slot_start:slot,
      status:removedAt !== undefined ? 'cancelled' : historic ? 'collected' : 'placed',
      placed_at:placed, updated_at:stamp(date,removedAt ?? (historic ? Number(slot.slice(0,2))*60+Number(slot.slice(3,5))+10 : madeAt)),
      total_kwd:(Number(dish.price_kwd)*quantity).toFixed(3), fixture_batch:batch});
    items.push({order_id:orderId,item_id:dish.id,item_name:dish.name,quantity,unit_price_kwd:dish.price_kwd});
  }
  for (const row of source) {
    const date = new Date(start + row.day*86400000).toISOString().slice(0,10);
    if (seededDates.has(date)) continue;
    const truck = trucks.find(t=>t.id===row.truck);
    const used = existing.find(e=>e.date===date && e.truck_id===row.truck && e.slot===row.slot)?.booked ?? 0;
    // Leave existing tickets untouched and never seed over the truck's capacity.
    row.bookings.slice(0,Math.max(0,truck.slot_capacity-used)).forEach((b,i)=>add(date,row.truck,row.slot,i,b.madeAt,b.removedAt,true));
    if (row.closedAt !== undefined && !closures.some(c=>c.date===date && c.truck_id===row.truck))
      pastClosures.set(`${date}/${row.truck}`,{truck_id:row.truck,service_date:date,closed_at:stamp(date,row.closedAt),closed_by:manager});
  }
  if (!seededDates.has(clock.today)) for (const [ti,truck] of trucks.entries()) {
    if (!truck.is_open || closures.some(c=>c.date===clock.today && c.truck_id===truck.id)) continue;
    const slots = source.filter(r=>r.day===0 && r.truck===truck.id).map(r=>r.slot)
      .filter(s=>Number(s.slice(0,2))*60+Number(s.slice(3,5))>=Number(clock.minute));
    const chosen = [...new Set([0,Math.floor(slots.length/3),Math.floor(2*slots.length/3),slots.length-1])].map(i=>slots[i]).filter(Boolean);
    for (const [si,slot] of chosen.entries()) {
      const used = existing.find(e=>e.date===clock.today && e.truck_id===truck.id && e.slot===slot)?.booked ?? 0;
      const count = Math.max(0,Math.min(1+(ti+si)%2,truck.slot_capacity-used-2));
      for(let i=0;i<count;i++) add(clock.today,truck.id,slot,i,Math.max(0,Math.min(Number(clock.minute)-5-i,Number(slot.slice(0,2))*60+Number(slot.slice(3,5))-20-i)),undefined,false);
    }
  }
  const report = { mode:apply?'apply':'dry-run',batch,serviceDate:clock.today,
    historicalOrders:orders.filter(o=>o.service_date<clock.today).length,
    upcomingOrders:orders.filter(o=>o.service_date===clock.today).length,
    historicalClosures:pastClosures.size,paymentMethod:'pay_at_pickup',paymentStatus:'unpaid',
    today:trucks.map(t=>({truck:t.id,orders:orders.filter(o=>o.truck_id===t.id && o.service_date===clock.today).length})),
    alreadySeededDates:seededDates.size };
  console.log(JSON.stringify(report,null,2));
  if (!apply) process.exitCode=0;
  else {
    await db.query('begin');
    await db.query("set local lock_timeout='10s'; set local statement_timeout='120s'");
    // Take the same row locks as checkout before importing, in a stable truck order.
    await db.query('select id from public.trucks order by id for update');
    await db.query('lock table public.orders in share row exclusive mode');
    const closed=(await db.query(`select count(*)::int as n from jsonb_to_recordset($1::jsonb) as x(truck_id text,service_date date)
      join public.trucks t on t.id=x.truck_id where x.service_date=$2::date and
      (not t.is_open or exists(select 1 from public.truck_closures c where c.truck_id=t.id and c.service_date=x.service_date))`,[JSON.stringify(orders),clock.today])).rows[0].n;
    if(closed) throw Error('truck_state_changed_run_again');
    const expired=(await db.query(`select count(*)::int as n from jsonb_to_recordset($1::jsonb) as x(service_date date,slot_start time,placed_at timestamptz)
      where service_date=$2::date and (placed_at>now() or placed_at>((service_date+slot_start) at time zone 'Asia/Kuwait')-interval '15 minutes')`,[JSON.stringify(orders),clock.today])).rows[0].n;
    if(expired) throw Error('pickup_window_changed_run_again');
    const before = (await db.query('select count(*)::int as n from public.orders where customer_id<>$1',[customer])).rows[0].n;
    const hasColumn = (await db.query("select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='fixture_batch'")).rowCount;
    if (!hasColumn) await db.query(readFileSync(new URL('../supabase/migrations/20261122170000_forecast_history.sql',import.meta.url),'utf8'));
    await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'qafla.rush-fixture@example.test',$2) on conflict(id) do nothing`,[customer,JSON.stringify({role:'customer',display_name:'Park guest',fixture_batch:batch})]);
    await db.query(`insert into public.orders(id,ticket_ref,customer_id,truck_id,service_date,slot_start,status,total_kwd,placed_at,updated_at,fixture_batch)
      select id,truck_id||'-'||lpad(nextval('private.order_ticket_seq')::text,6,'0'),customer_id,truck_id,service_date,slot_start,status,total_kwd,placed_at,updated_at,fixture_batch
      from jsonb_to_recordset($1::jsonb) as x(id uuid,customer_id uuid,truck_id text,service_date date,slot_start time,status public.order_status,total_kwd numeric,placed_at timestamptz,updated_at timestamptz,fixture_batch text)
      on conflict(id) do nothing`,[JSON.stringify(orders)]);
    await db.query(`insert into public.order_items select * from jsonb_to_recordset($1::jsonb) as x(order_id uuid,item_id text,item_name text,quantity integer,unit_price_kwd numeric) on conflict do nothing`,[JSON.stringify(items)]);
    await db.query(`insert into public.truck_closures select * from jsonb_to_recordset($1::jsonb) as x(truck_id text,service_date date,closed_by uuid,closed_at timestamptz) on conflict do nothing`,[JSON.stringify([...pastClosures.values()])]);
    const over = (await db.query(`select o.truck_id,o.service_date,o.slot_start from public.orders o join public.trucks t on t.id=o.truck_id
      where o.service_date >= $1::date - 56 and o.status not in ('cancelled','rejected')
      group by o.truck_id,o.service_date,o.slot_start,t.slot_capacity having count(*)>t.slot_capacity`,[clock.today])).rows;
    if (over.length) throw Error('capacity_check_failed');
    const after = (await db.query('select count(*)::int as n from public.orders where customer_id<>$1',[customer])).rows[0].n;
    if (before!==after) throw Error('existing_order_count_changed');
    await db.query('commit');
    console.log(JSON.stringify({committed:true,existingOrdersPreserved:before}));
  }
} catch(error) {
  await db.query('rollback').catch(()=>{});
  console.error(error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted]'));
  process.exitCode=1;
} finally { await db.end(); }
