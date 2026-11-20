// Database tests for the order foundation. Run with: pnpm test:db
//
// The story follows the Stitch screens: Dune Burgers, the 7:15 PM slot,
// ticket #DUNE-104, and Dana closing the truck at 7:06 PM. Those ticket
// numbers and that time of day exist ONLY in this fixture. The service date
// is always the real Kuwait date; only the time of day is pinned.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadMenuItems, loadTrucks } from "../../scripts/lib/seed-csv.mjs";
import {
  asUser,
  beginAs,
  check,
  passedCount,
  rejects,
  section,
  startDatabase,
  waitUntilBlocked,
} from "./harness.mjs";

const db = await startDatabase();
const { admin } = db;
let failed = false;

// --- fixture helpers -------------------------------------------------------

const today = (await admin.query("select (now() at time zone 'Asia/Kuwait')::date::text as d")).rows[0].d;

/** Pin the Kuwait time of day, e.g. setClock('19:06'). The date stays real. */
async function setClock(time) {
  await admin.query(
    `insert into test.clock (at) values (($1::date + $2::time) at time zone 'Asia/Kuwait')
     on conflict (only_row) do update set at = excluded.at`,
    [today, time],
  );
}

async function signUp(email, metadata = {}) {
  const { rows } = await admin.query(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(metadata)],
  );
  return rows[0].id;
}

const ORDER_COLUMNS =
  "id, ticket_ref, status, total_kwd::text as total_kwd, service_date::text as service_date, slot_start::text as slot_start";

// Every checkout attempt carries a request ID. Tests that are not about
// retries use a fresh one each time, as a new attempt would.
const placeSql = `select ${ORDER_COLUMNS} from public.place_order($1, $2::time, $3::jsonb, $4::uuid)`;
const place = async (client, truck, slot, items, requestId = randomUUID()) =>
  (await client.query(placeSql, [truck, slot, JSON.stringify(items), requestId])).rows[0];

const moveSql = `select ${ORDER_COLUMNS} from public.set_order_status($1, $2::public.order_status, $3)`;
const move = async (client, orderId, status, reason = null) =>
  (await client.query(moveSql, [orderId, status, reason])).rows[0];

/** Count rows the way the database owner sees them (no RLS). */
async function totals() {
  const { rows } = await admin.query(
    "select (select count(*) from public.orders)::int as orders, (select count(*) from public.order_items)::int as items",
  );
  return rows[0];
}

const QUALIFYING = "status not in ('rejected', 'cancelled')";

// Fixture only: give an order the ticket number shown on the Stitch screens.
// Real tickets are numbered by place_order (e.g. T02-000006).
const relabel = (orderId, ref) =>
  admin.query("update public.orders set ticket_ref = $1 where id = $2", [ref, orderId]);

// --- the tests -------------------------------------------------------------

try {
  console.log(`Isolated test database: PostgreSQL ${db.version} (embedded, temp folder)`);
  console.log(`Kuwait service date used: ${today}`);
  console.log("Applied in order:");
  for (const file of db.applied) console.log(`  - ${file}`);

  const c1 = await db.connect();
  const c2 = await db.connect();

  // -------------------------------------------------------------------------
  section("A. Seed data matches the CSVs");

  await check("6 trucks with the supplied IDs, names and capacities", async () => {
    const { rows } = await admin.query(
      "select id, name, cuisine, blurb, slot_capacity from public.trucks order by id",
    );
    assert.deepEqual(rows, loadTrucks());
    return rows.map((r) => `${r.id} ${r.name} (${r.slot_capacity})`).join(", ");
  });

  await check("30 dishes with the supplied IDs, names, prices and sold-out flags", async () => {
    const { rows } = await admin.query(
      `select id, truck_id, name, category, price_kwd::text as price_kwd, description, sold_out
       from public.menu_items order by id`,
    );
    assert.deepEqual(rows, loadMenuItems());
    const soldOut = rows.filter((r) => r.sold_out).map((r) => r.id);
    const blank = rows.filter((r) => r.description === null).length;
    return `30 rows; sold out: ${soldOut.join(", ")}; ${blank} without a description`;
  });

  await check("running seed.sql a second time changes nothing", async () => {
    await admin.query("update public.menu_items set price_kwd = 9.999 where id = 'M601'");
    await admin.query(db.seedSql);
    const { rows } = await admin.query(
      "select (select count(*) from public.trucks)::int as trucks, (select count(*) from public.menu_items)::int as items, (select price_kwd::text from public.menu_items where id = 'M601') as m601",
    );
    assert.deepEqual(rows[0], { trucks: 6, items: 30, m601: "9.999" });
    await admin.query("update public.menu_items set price_kwd = 1.200 where id = 'M601'");
    return "still 6 trucks and 30 dishes; an edited price was not overwritten";
  });

  // -------------------------------------------------------------------------
  section("B. Accounts and roles");

  const dana = await signUp("dana@qafla.test", { role: "manager", display_name: "Dana" });
  const duneVendor = await signUp("dune.vendor@qafla.test", { role: "vendor" });
  const tacoVendor = await signUp("taco.vendor@qafla.test", { role: "vendor" });
  const aisha = await signUp("aisha@qafla.test", { role: "customer" });
  const badr = await signUp("badr@qafla.test");
  const others = [];
  for (let i = 1; i <= 6; i += 1) others.push(await signUp(`customer${i}@qafla.test`));

  await check("signing up as 'manager' gives a customer account", async () => {
    const { rows } = await admin.query("select role from public.profiles where id = $1", [dana]);
    assert.equal(rows[0].role, "customer");
    return "requested role 'manager' -> saved role 'customer'";
  });

  await check("a customer cannot change their own role", async () => {
    await rejects(
      asUser(c1, aisha, (c) => c.query("update public.profiles set role = 'manager' where id = $1", [aisha])),
      "42501",
    );
    await rejects(
      asUser(c1, aisha, (c) => c.query("update public.profiles set role = 'vendor' where id = $1", [aisha])),
      "42501",
    );
    const { rows } = await admin.query("select role from public.profiles where id = $1", [aisha]);
    assert.equal(rows[0].role, "customer");
    return "permission denied (42501); role is still 'customer'";
  });

  // The only way to make a manager or assign a truck: SQL run by the owner.
  await admin.query("update public.profiles set role = 'manager' where id = $1", [dana]);
  await admin.query("update public.trucks set vendor_id = $1 where id = 'T02'", [duneVendor]);
  await admin.query("update public.trucks set vendor_id = $1 where id = 'T03'", [tacoVendor]);

  await check("a vendor cannot assign themselves another truck", async () => {
    await rejects(
      asUser(c1, tacoVendor, (c) => c.query("update public.trucks set vendor_id = $1 where id = 'T02'", [tacoVendor])),
      "42501",
    );
    return "permission denied (42501) on trucks.vendor_id";
  });

  await check("the migrations revoke rights on Qafla's objects only, not on an unrelated table or function", async () => {
    const can = async (role, table, privilege) =>
      (await admin.query("select has_table_privilege($1, $2, $3) as ok", [role, table, privilege])).rows[0].ok;

    // The unrelated table was created, with these grants, before the migrations ran.
    for (const privilege of ["select", "insert", "update", "delete"]) {
      assert.equal(await can("authenticated", "public.unrelated_notes", privilege), true, `authenticated ${privilege}`);
    }
    assert.equal(await can("anon", "public.unrelated_notes", "select"), true);
    await asUser(c1, aisha, (c) => c.query("insert into public.unrelated_notes values (1, 'still writable')"));
    assert.equal((await asUser(c1, null, (c) => c.query("select body from public.unrelated_notes"))).rowCount, 1);

    // The Qafla tables started with the same "everything" default and lost it.
    const qafla = ["profiles", "trucks", "menu_items", "truck_closures", "orders", "order_items"];
    for (const table of qafla) {
      for (const role of ["anon", "authenticated"]) {
        for (const privilege of ["insert", "delete", "truncate"]) {
          assert.equal(await can(role, `public.${table}`, privilege), false, `${role} ${privilege} ${table}`);
        }
      }
    }
    assert.equal(await can("anon", "public.orders", "select"), false);
    assert.equal(await can("authenticated", "public.orders", "update"), false);

    // Functions in the private schema: the unrelated one keeps what it had.
    const canRun = async (role, fn) =>
      (await admin.query("select has_function_privilege($1, $2, 'execute') as ok", [role, fn])).rows[0].ok;
    const publicCanRun = async (fn) =>
      (
        await admin.query(
          `select exists (
             select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
             where p.oid = $1::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'
           ) as ok`,
          [fn],
        )
      ).rows[0].ok;

    assert.equal(await publicCanRun("private.unrelated_helper()"), true, "PUBLIC keeps execute on the unrelated function");
    for (const role of ["anon", "authenticated"]) {
      assert.equal(await canRun(role, "private.unrelated_helper()"), true, `${role} unrelated_helper`);
    }
    const called = await asUser(c1, aisha, (c) => c.query("select private.unrelated_helper() as said"));
    assert.equal(called.rows[0].said, "still callable");
    assert.equal((await asUser(c1, null, (c) => c.query("select private.unrelated_helper() as said"))).rows[0].said, "still callable");

    // Qafla's own private functions: only the three the policies need.
    const policyHelpers = ["private.my_role()", "private.is_manager()", "private.my_truck_id()"];
    const internal = [
      "private.handle_new_user()",
      "private.clock_now()",
      "private.kuwait_now()",
      "private.require_read_committed()",
      "private.order_for_request(uuid, uuid, text, time, jsonb)",
      "private.lock_request(uuid, uuid)",
    ];
    for (const fn of [...policyHelpers, ...internal]) {
      assert.equal(await publicCanRun(fn), false, `PUBLIC must not run ${fn}`);
    }
    for (const role of ["anon", "authenticated"]) {
      for (const fn of policyHelpers) assert.equal(await canRun(role, fn), true, `${role} ${fn}`);
      for (const fn of internal) assert.equal(await canRun(role, fn), false, `${role} ${fn}`);
    }
    await rejects(asUser(c1, aisha, (c) => c.query("select private.clock_now()")), "42501");

    // The list of abandoned attempts is for the database's own use.
    for (const role of ["anon", "authenticated"]) {
      for (const privilege of ["select", "insert", "update", "delete"]) {
        assert.equal(await can(role, "private.abandoned_requests", privilege), false, `${role} ${privilege} abandoned_requests`);
      }
    }

    return "unrelated_notes keeps select/insert/update/delete and private.unrelated_helper() stays callable by PUBLIC, anon and authenticated; the 6 Qafla tables lost insert, delete and truncate; Qafla's 6 internal private functions and its abandoned-attempts table are closed to the API roles";
  });

  // -------------------------------------------------------------------------
  section("Step 1. Dune Burgers takes one Classic smash and one Loaded fries");

  const slot = "19:15";
  const cart = [
    { item_id: "M201", quantity: 1 },
    { item_id: "M204", quantity: 1 },
  ];

  // 6:30 PM: five earlier customers book the 7:15 PM slot.
  await setClock("18:30");
  const background = {};
  const backgroundCarts = {
    "DUNE-099": [{ item_id: "M201", quantity: 1 }],
    "DUNE-100": cart,
    "DUNE-101": [{ item_id: "M202", quantity: 1 }],
    "DUNE-102": [{ item_id: "M203", quantity: 2 }],
    "DUNE-103": [{ item_id: "M205", quantity: 1 }],
  };
  let n = 0;
  for (const [ref, items] of Object.entries(backgroundCarts)) {
    const customer = others[n];
    n += 1;
    const order = await asUser(c1, customer, (c) => place(c, "T02", slot, items));
    await relabel(order.id, ref);
    background[ref] = { id: order.id, customer };
  }

  await setClock("18:50");
  let order104;

  await check("the order is refused when the request tampers with price or quantity", async () => {
    const before = await totals();
    await rejects(
      asUser(c1, aisha, (c) => place(c, "T02", slot, [{ item_id: "M201", quantity: -1 }])),
      "invalid_quantity",
    );
    await rejects(asUser(c1, aisha, (c) => place(c, "T02", slot, [{ item_id: "M201", quantity: 0 }])), "invalid_quantity");
    await rejects(asUser(c1, aisha, (c) => place(c, "T02", slot, [{ item_id: "M201", quantity: 11 }])), "invalid_quantity");
    await rejects(asUser(c1, aisha, (c) => place(c, "T02", slot, [{ item_id: "M201", quantity: 1.5 }])), "invalid_quantity");
    await rejects(asUser(c1, aisha, (c) => place(c, "T02", slot, [])), "invalid_cart");
    await rejects(
      asUser(c1, aisha, (c) => place(c, "T02", slot, [{ item_id: "M301", quantity: 1 }])),
      "item_not_on_menu",
    );
    await rejects(asUser(c1, aisha, (c) => place(c, "T01", slot, [{ item_id: "M105", quantity: 1 }])), "item_sold_out");
    await rejects(asUser(c1, aisha, (c) => place(c, "T02", "19:07", cart)), "invalid_slot");
    await rejects(asUser(c1, aisha, (c) => place(c, "T02", "16:45", cart)), "invalid_slot");
    await rejects(asUser(c1, null, (c) => place(c, "T02", slot, cart)), "42501");
    await rejects(asUser(c1, duneVendor, (c) => place(c, "T02", slot, cart)), "not_a_customer");
    assert.deepEqual(await totals(), before);
    return "10 bad requests refused; no rows added";
  });

  await check("pickup times must be exactly on the quarter hour, to the microsecond", async () => {
    const snapshot = async () => ({
      ...(await totals()),
      usage: (
        await admin.query(
          "select slot_start::text as slot_start, booked from public.slot_usage('T02') where slot_start between '19:30' and '20:00' order by 1",
        )
      ).rows,
    });
    const before = await snapshot();

    // Just before and just after 7:45 PM. The .6 and .4 values are the ones
    // that rounding to whole seconds would have let through.
    const offGrid = ["19:44:59.999999", "19:45:00.000001", "19:44:59.6", "19:45:00.4", "19:45:01"];
    for (const time of offGrid) {
      await rejects(asUser(c1, aisha, (c) => place(c, "T02", time, cart)), "invalid_slot");
    }
    assert.deepEqual(await snapshot(), before);

    // The table refuses the same values by itself, even for the database owner.
    const insertSql = `insert into public.orders (ticket_ref, customer_id, truck_id, service_date, slot_start, total_kwd, placed_at, updated_at)
                       values ('GRID-TEST', $1, 'T02', $2, $3::time, 3.200, now(), now())`;
    for (const time of offGrid) {
      const error = await rejects(admin.query(insertSql, [aisha, today, time]), "23514");
      assert.equal(error.constraint, "orders_slot_on_grid");
    }
    assert.deepEqual(await snapshot(), before);

    // The exact boundary is accepted by the function and by the table.
    await beginAs(c1, aisha);
    const exact = await place(c1, "T02", "19:45:00.000000", cart);
    const during = (await c1.query("select booked from public.slot_usage('T02') where slot_start = '19:45'")).rows[0].booked;
    await c1.query("rollback");
    assert.equal(exact.slot_start, "19:45:00");
    assert.equal(exact.status, "placed");
    assert.equal(during, 1);

    await admin.query("begin");
    await admin.query(insertSql, [aisha, today, "19:45:00.000000"]);
    await admin.query("rollback");
    assert.deepEqual(await snapshot(), before);
    return `${offGrid.join(", ")} refused by place_order (invalid_slot) and by the table (orders_slot_on_grid); 19:45:00.000000 accepted; orders, items and occupancy unchanged`;
  });

  await check("the server prices the order at 3.200 KWD and ignores prices sent by the browser", async () => {
    const tampered = [
      { item_id: "M201", quantity: 1, price_kwd: 0.001, unit_price_kwd: 0 },
      { item_id: "M204", quantity: 1, price: -5, total: 0.001 },
    ];
    order104 = await asUser(c1, aisha, (c) => place(c, "T02", slot, tampered));
    assert.equal(order104.total_kwd, "3.200");
    assert.equal(order104.status, "placed");
    assert.equal(order104.service_date, today);
    assert.equal(order104.slot_start, "19:15:00");

    const { rows } = await admin.query(
      `select item_id, item_name, quantity, unit_price_kwd::text as unit_price_kwd
       from public.order_items where order_id = $1 order by item_id`,
      [order104.id],
    );
    assert.deepEqual(rows, [
      { item_id: "M201", item_name: "Classic smash", quantity: 1, unit_price_kwd: "1.950" },
      { item_id: "M204", item_name: "Loaded fries", quantity: 1, unit_price_kwd: "1.250" },
    ]);
    const realRef = order104.ticket_ref;
    await relabel(order104.id, "DUNE-104");
    return `total ${order104.total_kwd} KWD = 1.950 + 1.250; service date ${order104.service_date}; real ticket ${realRef} (shown as #DUNE-104 in this fixture)`;
  });

  await check("only the people involved can read the order", async () => {
    const read = (user) =>
      asUser(c1, user, async (c) => (await c.query("select id from public.orders where id = $1", [order104.id])).rowCount);
    const readItems = (user) =>
      asUser(c1, user, async (c) => (await c.query("select 1 from public.order_items where order_id = $1", [order104.id])).rowCount);
    assert.equal(await read(aisha), 1);
    assert.equal(await read(duneVendor), 1);
    assert.equal(await read(dana), 1);
    assert.equal(await read(badr), 0);
    assert.equal(await read(tacoVendor), 0);
    assert.equal(await readItems(aisha), 2);
    assert.equal(await readItems(badr), 0);
    assert.equal(await readItems(tacoVendor), 0);
    await rejects(asUser(c1, null, (c) => c.query("select id from public.orders")), "42501");
    return "customer, Dune vendor and manager: 1 row. Another customer and the Taco Saha vendor: 0 rows";
  });

  await check("nobody can skip the order rules", async () => {
    // Straight to the table: no INSERT or UPDATE right exists.
    await rejects(
      asUser(c1, aisha, (c) => c.query("update public.orders set status = 'collected' where id = $1", [order104.id])),
      "42501",
    );
    await rejects(
      asUser(c1, aisha, (c) =>
        c.query(
          `insert into public.orders (ticket_ref, customer_id, truck_id, service_date, slot_start, total_kwd, placed_at, updated_at)
           values ('FAKE', $1, 'T02', current_date, '19:30', 0.001, now(), now())`,
          [aisha],
        ),
      ),
      "42501",
    );
    // Through the function: wrong person or wrong step.
    await rejects(asUser(c1, aisha, (c) => move(c, order104.id, "accepted")), "transition_not_allowed");
    await rejects(asUser(c1, aisha, (c) => move(c, order104.id, "collected")), "transition_not_allowed");
    await rejects(asUser(c1, duneVendor, (c) => move(c, order104.id, "ready")), "transition_not_allowed");
    await rejects(asUser(c1, duneVendor, (c) => move(c, order104.id, "rejected")), "reason_required");
    await rejects(asUser(c1, duneVendor, (c) => move(c, order104.id, "rejected", " \t\n")), "reason_required");
    await rejects(asUser(c1, tacoVendor, (c) => move(c, order104.id, "accepted")), "order_not_found");
    await rejects(asUser(c1, badr, (c) => move(c, order104.id, "cancelled")), "order_not_found");
    await rejects(asUser(c1, dana, (c) => move(c, order104.id, "accepted")), "order_not_found");
    const { rows } = await admin.query("select status from public.orders where id = $1", [order104.id]);
    assert.equal(rows[0].status, "placed");
    return "10 attempts refused; the order is still 'placed'";
  });

  await check("the table itself refuses a rejected order without a real reason", async () => {
    // Written as the database owner, straight to the table, so set_order_status
    // and its own reason check are not involved at all.
    const rejectSql = "update public.orders set status = 'rejected', rejection_reason = $2 where id = $1";
    for (const reason of [null, "", "   ", "\t\n"]) {
      const error = await rejects(admin.query(rejectSql, [order104.id, reason]), "23514");
      assert.equal(error.constraint, "orders_rejection_has_reason");
    }
    const { rows } = await admin.query("select status, rejection_reason from public.orders where id = $1", [order104.id]);
    assert.deepEqual(rows[0], { status: "placed", rejection_reason: null });

    await admin.query("begin");
    const ok = await admin.query(rejectSql, [order104.id, "Out of beef"]);
    await admin.query("rollback");
    assert.equal(ok.rowCount, 1);
    return "null, empty, spaces and tab/newline reasons: check violation orders_rejection_has_reason; 'Out of beef' is accepted (rolled back)";
  });

  await check("the Dune Burgers vendor accepts the order and marks it preparing", async () => {
    const accepted = await asUser(c1, duneVendor, (c) => move(c, order104.id, "accepted"));
    const preparing = await asUser(c1, duneVendor, (c) => move(c, order104.id, "preparing"));
    assert.equal(accepted.status, "accepted");
    assert.equal(preparing.status, "preparing");
    await rejects(asUser(c1, duneVendor, (c) => move(c, order104.id, "accepted")), "transition_not_allowed");
    await rejects(asUser(c1, aisha, (c) => move(c, order104.id, "cancelled")), "transition_not_allowed");
    return "placed -> accepted -> preparing; going back and a late cancel are refused";
  });

  await check("a full slot refuses the next order, and a cancellation frees its place at once", async () => {
    const usage = async () =>
      (await asUser(c1, badr, (c) => c.query("select booked, capacity from public.slot_usage('T02') where slot_start = $1", [slot]))).rows[0];

    await setClock("18:55");
    assert.deepEqual(await usage(), { booked: 6, capacity: 6 });
    await rejects(asUser(c1, badr, (c) => place(c, "T02", slot, cart)), "slot_full");

    await setClock("18:58");
    const cancelled = await asUser(c1, background["DUNE-099"].customer, (c) => move(c, background["DUNE-099"].id, "cancelled"));
    assert.equal(cancelled.status, "cancelled");
    assert.deepEqual(await usage(), { booked: 5, capacity: 6 });
    return "6/6 -> slot_full; after #DUNE-099 is cancelled the same slot counts 5/6";
  });

  // Move the other tickets to where the Stitch board shows them.
  const advance = async (ref, ...steps) => {
    for (const status of steps) await asUser(c1, duneVendor, (c) => move(c, background[ref].id, status));
  };
  await advance("DUNE-101", "accepted", "preparing");
  await advance("DUNE-102", "accepted", "preparing", "ready");
  await advance("DUNE-103", "accepted");
  await setClock("19:02");
  await advance("DUNE-100", "accepted", "preparing", "ready", "collected");

  // -------------------------------------------------------------------------
  section("Step 2. 7:06 PM: five qualifying orders, and Dana closes Dune Burgers for tonight");

  await setClock("19:06");
  // The Stitch handoff: a second customer wants one Classic smash and one
  // Loaded fries (3.200 KWD) at 7:45 PM.
  const laterSlot = "19:45";
  const badrCart = cart;

  const managerSlotCount = async () =>
    (
      await asUser(c1, dana, (c) =>
        c.query(
          `select count(*)::int as qualifying, string_agg(ticket_ref || ' ' || status, ', ' order by ticket_ref) as tickets
           from public.orders
           where truck_id = 'T02' and service_date = $1 and slot_start = $2 and ${QUALIFYING}`,
          [today, slot],
        ),
      )
    ).rows[0];

  await check("the manager sees five qualifying orders in the 7:15 PM slot", async () => {
    const seen = await managerSlotCount();
    assert.equal(seen.qualifying, 5);
    return seen.tickets;
  });

  await check("the 7:15 PM slot has a free place but can no longer be booked (under 15 minutes away)", async () => {
    await rejects(asUser(c1, badr, (c) => place(c, "T02", slot, badrCart)), "slot_too_soon");
    return "slot_too_soon at 7:06 PM for 7:15 PM";
  });

  await check("only the manager can close a truck", async () => {
    await rejects(asUser(c1, aisha, (c) => c.query("select public.close_truck_for_tonight('T02')")), "not_a_manager");
    await rejects(asUser(c1, duneVendor, (c) => c.query("select public.close_truck_for_tonight('T02')")), "not_a_manager");
    await rejects(
      asUser(c1, dana, (c) =>
        c.query("insert into public.truck_closures values ('T02', current_date, $1, now())", [dana]),
      ),
      "42501",
    );
    return "customer and vendor: not_a_manager; writing the table directly: permission denied";
  });

  await check("immediately before the closure, the second customer's 7:45 PM cart is bookable", async () => {
    // Place it for real, look at the result, then roll the transaction back.
    await beginAs(c1, badr);
    const trial = await place(c1, "T02", laterSlot, badrCart);
    const lines = (await c1.query("select count(*)::int as n from public.order_items where order_id = $1", [trial.id])).rows[0].n;
    await c1.query("rollback");
    assert.equal(trial.status, "placed");
    assert.equal(trial.slot_start, "19:45:00");
    assert.equal(trial.total_kwd, "3.200");
    assert.equal(lines, 2);
    return `1 Classic smash + 1 Loaded fries for 7:45 PM accepted at ${trial.total_kwd} KWD, then rolled back so nothing was kept`;
  });

  await check("Dana closes Dune Burgers for the current Kuwait service date", async () => {
    const { rows } = await asUser(c1, dana, (c) =>
      c.query(
        `select truck_id, service_date::text as service_date,
                to_char(closed_at at time zone 'Asia/Kuwait', 'HH12:MI AM') as closed_at_kuwait
         from public.close_truck_for_tonight('T02')`,
      ),
    );
    assert.deepEqual(rows[0], { truck_id: "T02", service_date: today, closed_at_kuwait: "07:06 PM" });
    return `closure saved for ${rows[0].service_date} at ${rows[0].closed_at_kuwait} Kuwait time`;
  });

  // -------------------------------------------------------------------------
  section("Step 3. The second customer submits the same 7:45 PM request after the closure");

  await check("the database rejects it and saves no order and no order items", async () => {
    const before = await totals();
    const usage = async () =>
      (await admin.query("select booked from public.slot_usage('T02') where slot_start = $1", [laterSlot])).rows[0].booked;
    assert.equal(await usage(), 0);
    await rejects(asUser(c1, badr, (c) => place(c, "T02", laterSlot, badrCart)), "truck_closed");
    const after = await totals();
    assert.deepEqual(after, before);
    const { rows } = await admin.query("select count(*)::int as n from public.orders where customer_id = $1", [badr]);
    assert.equal(rows[0].n, 0);
    assert.equal(await usage(), 0);
    return `truck_closed; 7:45 PM stays 0/6; orders ${before.orders} -> ${after.orders}, order items ${before.items} -> ${after.items}; the customer has 0 orders`;
  });

  await check("the vendor's own switch cannot reopen a truck the manager closed", async () => {
    await asUser(c1, duneVendor, (c) => c.query("update public.trucks set is_open = true where id = 'T02'"));
    await rejects(asUser(c1, badr, (c) => place(c, "T02", laterSlot, badrCart)), "truck_closed");
    return "still truck_closed";
  });

  // -------------------------------------------------------------------------
  section("Step 4. The existing order is finished after the closure");

  await check("the assigned vendor marks #DUNE-104 ready and then collected", async () => {
    const ready = await asUser(c1, duneVendor, (c) => move(c, order104.id, "ready"));
    const collected = await asUser(c1, duneVendor, (c) => move(c, order104.id, "collected"));
    assert.equal(ready.status, "ready");
    assert.equal(collected.status, "collected");
    return "preparing -> ready -> collected";
  });

  await check("the customer reads the updated status", async () => {
    const { rows } = await asUser(c1, aisha, (c) =>
      c.query("select ticket_ref, status, total_kwd::text as total_kwd from public.orders where id = $1", [order104.id]),
    );
    assert.deepEqual(rows, [{ ticket_ref: "DUNE-104", status: "collected", total_kwd: "3.200" }]);
    return "#DUNE-104 collected, 3.200 KWD";
  });

  await check("the manager still sees five qualifying orders in the slot", async () => {
    const seen = await managerSlotCount();
    assert.equal(seen.qualifying, 5);
    const { rows } = await asUser(c1, aisha, (c) =>
      c.query("select booked, capacity from public.slot_usage('T02') where slot_start = $1", [slot]),
    );
    assert.deepEqual(rows[0], { booked: 5, capacity: 6 });
    return `${seen.tickets}; slot_usage 5/6`;
  });

  await check("a later price change does not alter the order", async () => {
    const changed = await asUser(c1, duneVendor, (c) => c.query("update public.menu_items set price_kwd = 2.500 where id = 'M201'"));
    assert.equal(changed.rowCount, 1);
    const blocked = await asUser(c1, tacoVendor, (c) => c.query("update public.menu_items set price_kwd = 0 where id = 'M204'"));
    assert.equal(blocked.rowCount, 0);
    const { rows } = await admin.query(
      `select o.total_kwd::text as total, i.unit_price_kwd::text as paid,
              (select price_kwd::text from public.menu_items where id = 'M201') as menu_now,
              (select price_kwd::text from public.menu_items where id = 'M204') as fries_now
       from public.orders o join public.order_items i on i.order_id = o.id and i.item_id = 'M201'
       where o.id = $1`,
      [order104.id],
    );
    assert.deepEqual(rows[0], { total: "3.200", paid: "1.950", menu_now: "2.500", fries_now: "1.250" });
    return "menu now 2.500; the order keeps 1.950 and 3.200. Another vendor's edit changed 0 rows";
  });

  // -------------------------------------------------------------------------
  section("Step 5. Two customers compete for the last place in an open slot");

  // Taco Saha (T03) takes 6 orders per slot. Fill 5, then race for the 6th.
  await setClock("18:00");
  const tacoCart = [{ item_id: "M301", quantity: 1 }];
  const slotCount = async (truck, s) =>
    (
      await admin.query(
        `select count(*)::int as n from public.orders
         where truck_id = $1 and service_date = $2 and slot_start = $3 and ${QUALIFYING}`,
        [truck, today, s],
      )
    ).rows[0].n;
  const fill = async (truck, s, items, count) => {
    // Use both connections so each has already run place_order before the race.
    for (let i = 0; i < count; i += 1) {
      await asUser(i % 2 ? c2 : c1, others[i % others.length], (c) => place(c, truck, s, items));
    }
  };

  await check("the second order waits for the first, then is refused (step by step)", async () => {
    await fill("T03", "20:00", tacoCart, 5);
    await beginAs(c1, aisha);
    const first = await place(c1, "T03", "20:00", tacoCart); // not committed yet
    await beginAs(c2, badr);
    const second = place(c2, "T03", "20:00", tacoCart).then(
      (row) => ({ ok: row }),
      (error) => ({ error }),
    );
    await waitUntilBlocked(admin, c2); // badr's request is queued behind aisha's lock
    await c1.query("commit");
    const outcome = await second;
    await c2.query("rollback");
    assert.equal(first.status, "placed");
    assert.equal(outcome.error?.message, "slot_full");
    assert.equal(await slotCount("T03", "20:00"), 6);
    return "first: placed; second: waited on the truck lock, then slot_full; slot holds 6/6";
  });

  await check("fired at the same instant, exactly one wins, five times out of five", async () => {
    const slots = ["20:15", "20:30", "20:45", "21:00", "21:15"];
    const lines = [];
    for (const s of slots) {
      await fill("T03", s, tacoCart, 5);
      await beginAs(c1, aisha);
      await beginAs(c2, badr);
      const settle = async (client, who) => {
        try {
          const row = await place(client, "T03", s, tacoCart);
          await client.query("commit");
          return { who, won: true, ref: row.ticket_ref };
        } catch (error) {
          await client.query("rollback");
          return { who, won: false, reason: error.message };
        }
      };
      // Alternate who sends first so neither customer has a head start every time.
      const pair = [() => settle(c1, "A"), () => settle(c2, "B")];
      if (lines.length % 2 === 1) pair.reverse();
      const results = await Promise.all(pair.map((start) => start()));
      const winners = results.filter((r) => r.won);
      const losers = results.filter((r) => !r.won);
      assert.equal(winners.length, 1);
      assert.equal(losers[0].reason, "slot_full");
      assert.equal(await slotCount("T03", s), 6);
      lines.push(`${s} winner ${winners[0].who}, other slot_full, 6/6`);
    }
    return lines.join("\n        -> ");
  });

  // -------------------------------------------------------------------------
  section("Extra. Placing an order at the same moment the manager closes the truck");

  const sajCart = [{ item_id: "M501", quantity: 1 }];
  const sweetCart = [{ item_id: "M601", quantity: 1 }];
  const closeSql = "select service_date::text as service_date from public.close_truck_for_tonight($1)";

  await check("if the closure gets the lock first, the order is refused", async () => {
    const before = await totals();
    await beginAs(c1, dana);
    await c1.query(closeSql, ["T05"]); // not committed yet
    await beginAs(c2, aisha);
    const order = place(c2, "T05", "20:00", sajCart).then(
      (row) => ({ ok: row }),
      (error) => ({ error }),
    );
    await waitUntilBlocked(admin, c2);
    await c1.query("commit");
    const outcome = await order;
    await c2.query("rollback");
    assert.equal(outcome.error?.message, "truck_closed");
    assert.deepEqual(await totals(), before);
    return "order waited for the closure, then truck_closed; nothing saved";
  });

  await check("if the order gets the lock first, it stands and the closure follows", async () => {
    await beginAs(c1, aisha);
    const order = await place(c1, "T06", "20:00", sweetCart); // not committed yet
    await beginAs(c2, dana);
    const closing = c2.query(closeSql, ["T06"]).then(
      (result) => ({ ok: result.rows[0] }),
      (error) => ({ error }),
    );
    await waitUntilBlocked(admin, c2);
    await c1.query("commit");
    const outcome = await closing;
    await c2.query("commit");
    assert.equal(outcome.ok?.service_date, today);
    const { rows } = await admin.query("select status from public.orders where id = $1", [order.id]);
    assert.equal(rows[0].status, "placed");
    await rejects(asUser(c1, badr, (c) => place(c, "T06", "20:15", sweetCart)), "truck_closed");
    return "order saved as 'placed'; closure then succeeded; the next order gets truck_closed";
  });

  // -------------------------------------------------------------------------
  section("Retrying the same checkout attempt never makes a second order");

  // What one attempt left behind: its orders, their lines, and the places
  // taken in the slot.
  const attempt = async (customer, requestId, truck, s) => {
    const { rows } = await admin.query(
      `select
         (select count(*) from public.orders where customer_id = $1 and client_request_id = $2)::int as orders,
         (select count(*) from public.order_items i join public.orders o on o.id = i.order_id
           where o.customer_id = $1 and o.client_request_id = $2)::int as lines,
         (select count(*) from public.orders
           where truck_id = $3 and service_date = $4 and slot_start = $5 and ${QUALIFYING})::int as places`,
      [customer, requestId, truck, today, s],
    );
    return rows[0];
  };

  const noodleCart = [
    { item_id: "M401", quantity: 1 },
    { item_id: "M404", quantity: 2 },
  ];
  const lostId = randomUUID();

  await check("a retry after a lost response returns the original ticket, even once the slot is full and the truck is closed", async () => {
    // Noodle Wagon (T04) takes 5 orders per slot.
    // The first response is "lost": the order is saved, the result is thrown away.
    const original = await asUser(c1, aisha, (c) => place(c, "T04", "20:00", noodleCart, lostId));
    assert.deepEqual(await attempt(aisha, lostId, "T04", "20:00"), { orders: 1, lines: 2, places: 1 });

    // Other customers take the 4 remaining places.
    for (let i = 0; i < 4; i += 1) {
      await asUser(c2, others[i], (c) => place(c, "T04", "20:00", noodleCart));
    }
    await rejects(asUser(c2, badr, (c) => place(c, "T04", "20:00", noodleCart)), "slot_full");

    // The customer taps again with the same request ID: same ticket, nothing new.
    const retryFull = await asUser(c1, aisha, (c) => place(c, "T04", "20:00", noodleCart, lostId));
    assert.equal(retryFull.id, original.id);
    assert.equal(retryFull.ticket_ref, original.ticket_ref);

    // Dana closes the truck. The retry still returns the same ticket.
    await asUser(c2, dana, (c) => c.query(closeSql, ["T04"]));
    const retryClosed = await asUser(c1, aisha, (c) => place(c, "T04", "20:00", [...noodleCart].reverse(), lostId));
    assert.equal(retryClosed.id, original.id);
    assert.equal(retryClosed.total_kwd, original.total_kwd);

    // A genuinely new attempt is still refused.
    await rejects(asUser(c1, aisha, (c) => place(c, "T04", "20:15", noodleCart)), "truck_closed");

    assert.deepEqual(await attempt(aisha, lostId, "T04", "20:00"), { orders: 1, lines: 2, places: 5 });
    return `${original.ticket_ref} returned for both retries (slot 5/5, then truck closed); this attempt left 1 order, 2 lines, 1 place`;
  });

  const karakCart = [{ item_id: "M101", quantity: 2 }];
  const doubleId = randomUUID();

  await check("two submissions of the same attempt at once: the second waits, then gets the first one's ticket", async () => {
    await beginAs(c1, aisha);
    const first = await place(c1, "T01", "20:00", karakCart, doubleId); // not committed yet
    await beginAs(c2, aisha);
    const second = place(c2, "T01", "20:00", karakCart, doubleId).then(
      (row) => ({ ok: row }),
      (error) => ({ error }),
    );
    await waitUntilBlocked(admin, c2); // queued behind the first copy's truck lock
    await c1.query("commit");
    const outcome = await second;
    await c2.query("commit");
    assert.equal(outcome.ok?.id, first.id);
    assert.deepEqual(await attempt(aisha, doubleId, "T01", "20:00"), { orders: 1, lines: 1, places: 1 });
    return `both copies answered with ${first.ticket_ref}; 1 order, 1 line, 1 place`;
  });

  await check("fired at the same instant, the same attempt makes one order, five times out of five", async () => {
    const slots = ["20:15", "20:30", "20:45", "21:00", "21:15"];
    for (const [round, s] of slots.entries()) {
      const id = randomUUID();
      const [a, b] = await Promise.all(
        (round % 2 ? [c2, c1] : [c1, c2]).map((client) =>
          asUser(client, aisha, (c) => place(c, "T01", s, karakCart, id)),
        ),
      );
      assert.equal(a.id, b.id);
      assert.deepEqual(await attempt(aisha, id, "T01", s), { orders: 1, lines: 1, places: 1 });
    }
    return "5 rounds: both copies returned the same ticket; each round left 1 order, 1 line, 1 place";
  });

  await check("a request ID cannot be reused for a different order, and cannot be left out", async () => {
    const before = await totals();
    const reuse = (truck, s, items) =>
      rejects(asUser(c1, aisha, (c) => place(c, truck, s, items, doubleId)), "request_id_reused");
    await reuse("T01", "21:30", karakCart); // another time
    await reuse("T01", "20:00", [{ item_id: "M101", quantity: 3 }]); // another quantity
    await reuse("T01", "20:00", [...karakCart, { item_id: "M102", quantity: 1 }]); // an extra dish
    await reuse("T03", "21:30", tacoCart); // another truck
    // Another customer may happen to send the same ID: it is theirs, not a reuse.
    const badrs = await asUser(c2, badr, (c) => place(c, "T01", "20:00", karakCart, doubleId));
    assert.equal(badrs.status, "placed");
    await rejects(asUser(c1, aisha, (c) => place(c, "T01", "21:30", karakCart, null)), "request_id_required");
    const after = await totals();
    assert.deepEqual(after, { orders: before.orders + 1, items: before.items + 1 });
    return "another time, quantity, dish or truck: request_id_reused; no ID: request_id_required; only the other customer's own order was added";
  });

  await check("the same ID sent for two trucks at once: only one saves", async () => {
    const id = randomUUID();
    await beginAs(c1, aisha);
    const first = await place(c1, "T01", "21:45", karakCart, id); // not committed yet
    await beginAs(c2, aisha);
    // Same customer, same request ID: this copy waits for the first one's
    // request lock. When it gets in, the ID already belongs to another order.
    const second = place(c2, "T03", "21:45", tacoCart, id).then(
      (row) => ({ ok: row }),
      (error) => ({ error }),
    );
    await waitUntilBlocked(admin, c2);
    await c1.query("commit");
    const outcome = await second;
    await c2.query("rollback");
    assert.equal(outcome.error?.message, "request_id_reused");
    assert.deepEqual(await attempt(aisha, id, "T01", "21:45"), { orders: 1, lines: 1, places: 1 });
    assert.equal(await slotCount("T03", "21:45"), 0);
    return `${first.ticket_ref} saved; the second truck's copy was refused with request_id_reused and saved nothing`;
  });

  await check("checkout's read-only lookup finds the customer's own saved attempt, and nobody else's", async () => {
    // This is the question checkout asks after a refresh: "was my attempt
    // saved?" It only reads, so asking can never place an order.
    const lookup = (client, user, customer, requestId) =>
      asUser(client, user, async (c) => {
        const { rows } = await c.query(
          "select id, ticket_ref from public.orders where customer_id = $1 and client_request_id = $2",
          [customer, requestId],
        );
        return rows;
      });
    const before = await totals();

    // Aisha's lost attempt on Noodle Wagon: the slot is full and the truck is closed.
    const mine = await lookup(c1, aisha, aisha, lostId);
    assert.equal(mine.length, 1);
    // Badr asks about Aisha's attempt, as her and as himself: nothing.
    assert.deepEqual(await lookup(c2, badr, aisha, lostId), []);
    assert.deepEqual(await lookup(c2, badr, badr, lostId), []);
    // An attempt that was never saved: nothing, so checkout knows it was not placed.
    assert.deepEqual(await lookup(c1, aisha, aisha, randomUUID()), []);

    assert.deepEqual(await totals(), before);
    return `${mine[0].ticket_ref} found for its own customer on a full slot and closed truck; another customer and an unsaved attempt both find nothing; no rows added`;
  });

  // -------------------------------------------------------------------------
  section("Giving up on an attempt whose answer never arrived");

  // "Was my attempt saved?" is the read-only question checkout asks. An empty
  // answer does NOT mean the attempt failed: these tests hold the original
  // request in flight to show that, then let the database decide the race
  // between "place it" and "abandon it".
  const c3 = await db.connect();
  const findAttempt = (client, user, requestId) =>
    asUser(client, user, async (c) => {
      const { rows } = await c.query(
        "select id from public.orders where customer_id = $1 and client_request_id = $2",
        [user, requestId],
      );
      return rows;
    });
  const abandonSql = `select ${ORDER_COLUMNS} from public.abandon_order_attempt($1::uuid)`;
  const abandon = async (client, requestId) => (await client.query(abandonSql, [requestId])).rows[0];
  const abandonedCount = async (customer, requestId) =>
    (
      await admin.query(
        "select count(*)::int as n from private.abandoned_requests where customer_id = $1 and request_id = $2",
        [customer, requestId],
      )
    ).rows[0].n;
  const settled = (promise) =>
    promise.then(
      (row) => ({ ok: row }),
      (error) => ({ error }),
    );

  // Taco Saha (T03) is still open. Two lines: one taco and two elote cups.
  const tacoPair = [
    { item_id: "M301", quantity: 1 },
    { item_id: "M304", quantity: 2 },
  ];

  await check("placing wins: the original request is still in flight, the lookup is empty, and giving up returns its ticket", async () => {
    const id = randomUUID();
    // The original request has saved its order but has not finished yet.
    await beginAs(c1, aisha);
    const original = await place(c1, "T03", "18:30", tacoPair, id);
    // The read-only lookup sees nothing, although the order is on its way.
    assert.deepEqual(await findAttempt(c3, aisha, id), []);
    // The customer gives up. The database makes this wait for the request.
    await beginAs(c2, aisha);
    const givingUp = settled(abandon(c2, id));
    await waitUntilBlocked(admin, c2);
    assert.equal(await abandonedCount(aisha, id), 0);
    await c1.query("commit"); // the original request finishes
    const outcome = await givingUp;
    await c2.query("commit");

    assert.equal(outcome.ok?.id, original.id);
    assert.equal(outcome.ok?.ticket_ref, original.ticket_ref);
    assert.equal(await abandonedCount(aisha, id), 0);
    assert.deepEqual(await attempt(aisha, id, "T03", "18:30"), { orders: 1, lines: 2, places: 1 });
    // Tapping Place order again with the same ID still returns that ticket.
    const again = await asUser(c1, aisha, (c) => place(c, "T03", "18:30", tacoPair, id));
    assert.equal(again.id, original.id);
    return `lookup was empty while the request was in flight; giving up waited, then returned ${original.ticket_ref}; 1 order, 2 lines, 1 place, nothing recorded as abandoned`;
  });

  await check("giving up wins: the original request is held in flight, then refused, and the customer orders at another time", async () => {
    const id = randomUUID();
    // The customer gives up first. The decision is made but not finished yet.
    await beginAs(c2, aisha);
    const gaveUp = await abandon(c2, id);
    assert.equal(gaveUp.id, null);
    // The original request arrives now and is held behind that decision.
    await beginAs(c1, aisha);
    const late = settled(place(c1, "T03", "18:45", tacoPair, id));
    await waitUntilBlocked(admin, c1);
    assert.deepEqual(await findAttempt(c3, aisha, id), []); // still empty: proves nothing by itself
    await c2.query("commit"); // giving up is now final
    const outcome = await late;
    await c1.query("rollback");

    assert.equal(outcome.error?.message, "request_abandoned");
    assert.equal(await abandonedCount(aisha, id), 1);
    assert.deepEqual(await attempt(aisha, id, "T03", "18:45"), { orders: 0, lines: 0, places: 0 });
    // Any later copy of the old request is refused too.
    await rejects(asUser(c1, aisha, (c) => place(c, "T03", "18:45", tacoPair, id)), "request_abandoned");
    // The cart is unlocked: a new attempt at another time works.
    const freshId = randomUUID();
    const fresh = await asUser(c1, aisha, (c) => place(c, "T03", "19:00", tacoPair, freshId));
    assert.deepEqual(await attempt(aisha, freshId, "T03", "19:00"), { orders: 1, lines: 2, places: 1 });
    assert.equal(await slotCount("T03", "18:45"), 0);
    return `the held request was refused with request_abandoned and left 0 orders, 0 lines, 0 places at 6:45 PM; the new attempt ${fresh.ticket_ref} took 1 place at 7:00 PM`;
  });

  await check("a request that never reached the server: giving up works, twice is the same as once, and a late copy is refused", async () => {
    const id = randomUUID();
    const before = await totals();
    assert.deepEqual(await findAttempt(c3, aisha, id), []);
    const first = await asUser(c1, aisha, (c) => abandon(c, id));
    const second = await asUser(c1, aisha, (c) => abandon(c, id)); // the answer to the first was lost too
    assert.equal(first.id, null);
    assert.equal(second.id, null);
    assert.equal(await abandonedCount(aisha, id), 1);
    assert.deepEqual(await totals(), before);

    // The request turns up after all (it was only delayed): refused.
    await rejects(asUser(c2, aisha, (c) => place(c, "T03", "19:15", tacoPair, id)), "request_abandoned");
    // Another customer who happens to use the same ID is not affected.
    const badrs = await asUser(c2, badr, (c) => place(c, "T03", "19:15", tacoPair, id));
    assert.equal(badrs.status, "placed");
    // The customer's way out: a new attempt at a time of their choice.
    const freshId = randomUUID();
    const fresh = await asUser(c1, aisha, (c) => place(c, "T03", "19:30", tacoPair, freshId));
    assert.deepEqual(await attempt(aisha, freshId, "T03", "19:30"), { orders: 1, lines: 2, places: 1 });
    assert.deepEqual(await attempt(aisha, id, "T03", "19:15"), { orders: 0, lines: 0, places: 1 }); // the 1 place is Badr's
    return `giving up returned no order both times and was recorded once; the late copy got request_abandoned; ${fresh.ticket_ref} placed with a new ID`;
  });

  await check("placing and giving up fired at the same instant: exactly one wins, five times out of five", async () => {
    const slots = ["21:30", "21:45", "22:00", "22:15", "22:30"];
    const wins = { placed: 0, abandoned: 0 };
    for (const [round, s] of slots.entries()) {
      const id = randomUUID();
      const placing = () => settled(asUser(c1, aisha, (c) => place(c, "T03", s, tacoPair, id)));
      const givingUp = () => settled(asUser(c2, aisha, (c) => abandon(c, id)));
      const [placed, gaveUp] =
        round % 2 ? (await Promise.all([givingUp(), placing()])).reverse() : await Promise.all([placing(), givingUp()]);
      const left = await attempt(aisha, id, "T03", s);
      const recorded = await abandonedCount(aisha, id);
      if (placed.ok) {
        // Placing won: giving up must have answered with the same ticket.
        assert.equal(gaveUp.ok?.id, placed.ok.id);
        assert.equal(recorded, 0);
        assert.deepEqual(left, { orders: 1, lines: 2, places: 1 });
        wins.placed += 1;
      } else {
        // Giving up won: the request must have been refused and saved nothing.
        assert.equal(placed.error?.message, "request_abandoned");
        assert.equal(gaveUp.ok?.id, null);
        assert.equal(recorded, 1);
        assert.deepEqual(left, { orders: 0, lines: 0, places: 0 });
        wins.abandoned += 1;
      }
    }
    return `5 rounds: placing won ${wins.placed}, giving up won ${wins.abandoned}; never both, never neither`;
  });

  await check("only the signed-in customer can give up their own attempts", async () => {
    const id = randomUUID();
    await rejects(asUser(c1, null, (c) => abandon(c, id)), "42501"); // signed out
    await rejects(asUser(c1, duneVendor, (c) => abandon(c, id)), "not_a_customer");
    await rejects(asUser(c1, aisha, (c) => abandon(c, null)), "request_id_required");
    assert.equal(await abandonedCount(aisha, id), 0);
    // Badr giving up an ID does nothing to Aisha's attempt with the same ID.
    await asUser(c2, badr, (c) => abandon(c, id));
    const aishas = await asUser(c1, aisha, (c) => place(c, "T03", "22:45", tacoPair, id));
    assert.equal(aishas.status, "placed");
    return "signed-out visitors and vendors are refused; one customer's decision does not touch another customer's attempt";
  });

  // -------------------------------------------------------------------------
  section("The kitchen board: one truck's tickets, moved one step at a time");

  const boardSlot = "19:45";
  let boardOrder;

  await check("a vendor's board reads its own truck's tickets and lines, and nothing from another truck", async () => {
    boardOrder = await asUser(c2, badr, (c) => place(c, "T03", boardSlot, tacoPair));
    const read = (vendor, truck) =>
      asUser(c1, vendor, async (c) => ({
        orders: (await c.query("select count(*)::int as n from public.orders where truck_id = $1 and service_date = $2", [truck, today])).rows[0].n,
        lines: (
          await c.query(
            "select count(*)::int as n from public.order_items i join public.orders o on o.id = i.order_id where o.truck_id = $1",
            [truck],
          )
        ).rows[0].n,
      }));
    const own = await read(tacoVendor, "T03");
    const other = await read(tacoVendor, "T02");
    assert.ok(own.orders > 0 && own.lines > 0);
    assert.deepEqual(other, { orders: 0, lines: 0 });
    assert.deepEqual(await read(duneVendor, "T03"), { orders: 0, lines: 0 });
    return `Taco Saha's vendor reads ${own.orders} of its tickets and 0 of Dune Burgers'; the Dune Burgers vendor reads 0 of Taco Saha's`;
  });

  await check("a ticket goes placed, accepted, preparing, ready, collected, and tapping an action twice saves it once", async () => {
    const seen = [];
    for (const status of ["accepted", "preparing", "ready", "collected"]) {
      seen.push((await asUser(c1, tacoVendor, (c) => move(c, boardOrder.id, status))).status);
      // The same tap again (a retry after a lost answer) changes nothing.
      await rejects(asUser(c1, tacoVendor, (c) => move(c, boardOrder.id, status)), "transition_not_allowed");
    }
    assert.deepEqual(seen, ["accepted", "preparing", "ready", "collected"]);
    const { rows } = await asUser(c2, badr, (c) =>
      c.query("select status from public.orders where id = $1", [boardOrder.id]),
    );
    assert.equal(rows[0].status, "collected");
    return "4 moves saved, 4 repeats refused; the customer reads 'collected'";
  });

  await check("a collected ticket still holds its place in the slot", async () => {
    assert.equal(await slotCount("T03", boardSlot), 1);
    const { rows } = await asUser(c2, badr, (c) =>
      c.query("select booked from public.slot_usage('T03') where slot_start = $1", [boardSlot]),
    );
    assert.equal(rows[0].booked, 1);
    return "1 qualifying order before and after collection";
  });

  await check("rejecting a placed ticket needs a reason; the customer reads it and the place is freed", async () => {
    const order = await asUser(c2, badr, (c) => place(c, "T03", boardSlot, tacoPair));
    assert.equal(await slotCount("T03", boardSlot), 2);
    await rejects(asUser(c1, tacoVendor, (c) => move(c, order.id, "rejected")), "reason_required");
    await asUser(c1, tacoVendor, (c) => move(c, order.id, "rejected", "  We ran out of an ingredient "));
    const { rows } = await asUser(c2, badr, (c) =>
      c.query("select status, rejection_reason from public.orders where id = $1", [order.id]),
    );
    assert.deepEqual(rows[0], { status: "rejected", rejection_reason: "We ran out of an ingredient" });
    assert.equal(await slotCount("T03", boardSlot), 1);
    // A rejected ticket is finished: no further kitchen action.
    await rejects(asUser(c1, tacoVendor, (c) => move(c, order.id, "accepted")), "transition_not_allowed");
    return "refused without a reason; saved with one; slot back to 1 place taken";
  });

  await check("live updates are switched on for orders only", async () => {
    const { rows } = await admin.query(
      "select schemaname || '.' || tablename as t from pg_publication_tables where pubname = 'supabase_realtime' order by 1",
    );
    assert.deepEqual(rows.map((r) => r.t), ["public.orders"]);
    return "supabase_realtime publishes public.orders; who hears a change is still decided by orders_select";
  });

  console.log(`\n${passedCount()} checks passed.`);
} catch (error) {
  failed = true;
  console.error(`\nStopped after ${passedCount()} passing checks.`);
  if (!(error instanceof assert.AssertionError)) console.error(error);
} finally {
  await db.stop();
}

process.exitCode = failed ? 1 : 0;
