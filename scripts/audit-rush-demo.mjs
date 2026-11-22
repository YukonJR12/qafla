// Owner read-only audit; outputs aggregate fixture provenance, never credentials or customers.
import pg from 'pg';
import {writeFileSync} from 'node:fs';
import {dashboard,validate,known} from '../lib/rush.ts';
import {serviceDay,replayDate} from '../lib/rush-data.ts';
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL});
try {
  await db.connect();
  await db.query('begin read only');
  const manager=(await db.query("select id from public.profiles where role='manager' order by created_at limit 1")).rows[0].id;
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:manager,role:'authenticated'})]);
  const data=(await db.query('select public.forecast_history() as data')).rows[0].data;
  const today=data.history.filter(r=>r.serviceDate===data.serviceDate);
  let matching=0;
  for(const truck of [...new Set(today.map(r=>r.truck))]){
    const slots=(await db.query('select * from public.slot_usage($1)',[truck])).rows;
    for(const s of slots){
      const r=today.find(r=>r.truck===truck&&r.slot===s.slot_start);
      if(known(r,data.now)!==Number(s.booked)) throw Error(`occupancy_mismatch ${truck} ${s.slot_start}`);
      matching++;
    }
  }
  const counts=(await db.query(`select truck_id,count(*) filter(where service_date< $1::date)::int as historical,
    count(*) filter(where service_date=$1::date)::int as today from public.orders where fixture_batch='rush-demo-v1' group by truck_id order by truck_id`,[data.serviceDate])).rows;
  const replay=replayDate(data), day=serviceDay(replay);
  const sample=dashboard(data.history,day,1140).risk[0];
  const report={checkedAt:new Date().toISOString(),serviceDate:data.serviceDate,source:'Owner-authorized synthetic fixtures in shared demo database',counts,
    matchingOccupancyCells:matching,validation:validate(data.history,serviceDay(data.serviceDate)),replayDate:replay,
    replay:sample&&{truck:sample.truck,slot:sample.slot,current:sample.current,capacity:sample.capacity,projected:sample.projected,range:[sample.low,sample.high],
      final:known(data.history.find(r=>r.day===day&&r.truck===sample.truck&&r.slot===sample.slot),sample.cutoff)},
    payments:(await db.query("select count(*)::int as n from public.order_payments p join public.orders o on o.id=p.order_id where o.fixture_batch='rush-demo-v1'")).rows[0].n};
  await db.query('rollback');
  if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await db.end();}
