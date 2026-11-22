import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startDatabase,asUser} from './harness.mjs';
const db=await startDatabase();
try {
  const manager=(await db.admin.query("insert into auth.users(email) values('fixture-manager@example.test') returning id")).rows[0].id;
  await db.admin.query("update public.profiles set role='manager' where id=$1",[manager]);
  const config=db.admin.connectionParameters;
  const env={...process.env,SUPABASE_DB_URL:`postgresql://postgres:postgres@127.0.0.1:${config.port}/postgres`};
  const run=()=>promisify(execFile)(process.execPath,['scripts/seed-rush-demo.mjs','--apply'],{env,windowsHide:true,timeout:120000});
  await run();
  const before=(await db.admin.query('select count(*)::int as n from public.orders')).rows[0].n;
  assert.ok(before>10000);
  await run();
  assert.equal((await db.admin.query('select count(*)::int as n from public.orders')).rows[0].n,before);
  const data=(await asUser(db.admin,manager,c=>c.query('select public.forecast_history() as data'))).rows[0].data;
  const slots=(await asUser(db.admin,manager,c=>c.query("select * from public.slot_usage('T02')"))).rows;
  for(const slot of slots){
    const r=data.history.find(r=>r.serviceDate===data.serviceDate && r.truck==='T02' && r.slot===slot.slot_start);
    assert.equal(r.bookings.filter(b=>b.madeAt<=data.now && (b.removedAt===undefined||b.removedAt>data.now)).length,Number(slot.booked));
  }
  assert.equal((await db.admin.query("select count(*)::int as n from public.orders where placed_at>now() or payment_method<>'pay_at_pickup' or payment_status<>'unpaid'")).rows[0].n,0);
  assert.equal((await db.admin.query('select count(*)::int as n from public.order_payments')).rows[0].n,0);
  console.log(`PASS: ${before} fixture orders imported atomically; rerun idempotent; forecast/occupancy agree; no future placements or payments.`);
} finally {await db.stop();}
