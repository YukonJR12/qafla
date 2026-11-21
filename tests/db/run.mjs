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

  // -------------------------------------------------------------------------
  section("Slot capacity: one number per truck, set by its vendor, and no order is ever lost");

  // Taco Saha (T03) starts at 6 per pickup time. Five customers book a
  // pickup time that no earlier test has used.
  await setClock("18:00");
  const emptySlots = (
    await admin.query(
      `select to_char(s, 'HH24:MI') as slot
       from (select time '19:00' + n * interval '15 minutes' as s from generate_series(0, 15) as n) as slots
       where not exists (select 1 from public.orders o where o.truck_id = 'T03' and o.service_date = $1 and o.slot_start = s)
       order by s`,
      [today],
    )
  ).rows.map((r) => r.slot);
  assert.ok(emptySlots.length >= 2);
  const [capSlot, raceSlot] = emptySlots;
  const capOrders = [];
  const setCapacity = (client, user, truck, n) =>
    asUser(client, user, async (c) => (await c.query("update public.trucks set slot_capacity = $2 where id = $1 returning slot_capacity", [truck, n])).rows);
  const capacityOf = async (truck) => (await admin.query("select slot_capacity from public.trucks where id = $1", [truck])).rows[0].slot_capacity;
  const usageAt = async (user, truck, s) =>
    (await asUser(c1, user, (c) => c.query("select booked, capacity from public.slot_usage($1) where slot_start = $2", [truck, s]))).rows[0];
  const capStatuses = async () =>
    (await admin.query("select ticket_ref, status::text as status from public.orders where id = any($1) order by placed_at, ticket_ref", [capOrders.map((o) => o.id)])).rows;

  await check("capacity is stored once per truck, and only the truck's own vendor can change it, within 1 to 20", async () => {
    const { rows } = await admin.query(
      "select column_name from information_schema.columns where table_schema = 'public' and column_name ilike '%capacity%' order by 1",
    );
    assert.deepEqual(rows.map((r) => r.column_name), ["slot_capacity"]); // on trucks; nothing per pickup time
    assert.equal(await capacityOf("T03"), 6);
    // Everyone else: the update matches no row they are allowed to change.
    for (const outsider of [badr, dana, duneVendor]) assert.deepEqual(await setCapacity(c1, outsider, "T03", 3), []);
    assert.equal(await capacityOf("T03"), 6);
    // The vendor: refused outside 1 to 20 by the column's check.
    await rejects(setCapacity(c1, tacoVendor, "T03", 0), "23514");
    await rejects(setCapacity(c1, tacoVendor, "T03", 21), "23514");
    assert.equal(await capacityOf("T03"), 6);
    return "trucks.slot_capacity only; a customer, the manager and another truck's vendor change nothing; 0 and 21 are refused";
  });

  await check("fixture: five qualifying bookings in one pickup time with capacity six", async () => {
    assert.equal(await slotCount("T03", capSlot), 0);
    for (let i = 0; i < 5; i += 1) capOrders.push({ ...(await asUser(c1, others[i], (c) => place(c, "T03", capSlot, tacoCart))), customer: others[i] });
    // Not all at 'placed': the kitchen has started on some.
    await asUser(c1, tacoVendor, (c) => move(c, capOrders[0].id, "accepted"));
    await asUser(c1, tacoVendor, (c) => move(c, capOrders[1].id, "accepted"));
    await asUser(c1, tacoVendor, (c) => move(c, capOrders[1].id, "preparing"));
    assert.deepEqual(await usageAt(badr, "T03", capSlot), { booked: 5, capacity: 6 });
    return `${capSlot}: ` + (await capStatuses()).map((o) => `${o.ticket_ref} ${o.status}`).join(", ") + "; slot_usage 5/6";
  });

  await check("the vendor lowers capacity to five: the slot is full at 5 of 5 and all five tickets are kept", async () => {
    const before = await capStatuses();
    const totalsBefore = await totals();
    assert.deepEqual(await setCapacity(c1, tacoVendor, "T03", 5), [{ slot_capacity: 5 }]);

    // Checkout reads slot_usage: 5 of 5, and the database refuses a sixth order.
    assert.deepEqual(await usageAt(badr, "T03", capSlot), { booked: 5, capacity: 5 });
    await rejects(asUser(c2, badr, (c) => place(c, "T03", capSlot, tacoCart)), "slot_full");
    // It is one setting for the truck: every pickup time now reads capacity 5.
    const all = (await asUser(c1, badr, (c) => c.query("select distinct capacity from public.slot_usage('T03')"))).rows;
    assert.deepEqual(all, [{ capacity: 5 }]);
    // Dana reads 5 of 5 and the five tickets behind it.
    assert.deepEqual(await usageAt(dana, "T03", capSlot), { booked: 5, capacity: 5 });
    const danaSees = (
      await asUser(c1, dana, (c) =>
        c.query(`select count(*)::int as n from public.orders where truck_id = 'T03' and service_date = $1 and slot_start = $2 and ${QUALIFYING}`, [today, capSlot]),
      )
    ).rows[0].n;
    assert.equal(danaSees, 5);
    // The kitchen still has all five, each in the status it had.
    const kitchen = (
      await asUser(c1, tacoVendor, (c) => c.query("select count(*)::int as n from public.orders where id = any($1)", [capOrders.map((o) => o.id)]))
    ).rows[0].n;
    assert.equal(kitchen, 5);
    assert.deepEqual(await capStatuses(), before);
    assert.deepEqual(await totals(), totalsBefore);
    return "slot_usage 5/5 for customer and manager; sixth order gets slot_full; 5 tickets unchanged; capacity 5 on all 24 times";
  });

  await check("capacity below existing bookings is allowed: every order stays, and the slot takes no new one until it drops below the limit", async () => {
    const before = await capStatuses();
    assert.deepEqual(await setCapacity(c1, tacoVendor, "T03", 4), [{ slot_capacity: 4 }]);
    assert.deepEqual(await capStatuses(), before); // nothing cancelled, nothing moved
    assert.deepEqual(await usageAt(badr, "T03", capSlot), { booked: 5, capacity: 4 });
    await rejects(asUser(c2, badr, (c) => place(c, "T03", capSlot, tacoCart)), "slot_full");
    // The kitchen can still work the tickets it already has.
    assert.equal((await asUser(c1, tacoVendor, (c) => move(c, capOrders[1].id, "ready"))).status, "ready");
    // One customer cancels: 4 of 4 is still full.
    await asUser(c1, capOrders[4].customer, (c) => move(c, capOrders[4].id, "cancelled"));
    assert.deepEqual(await usageAt(badr, "T03", capSlot), { booked: 4, capacity: 4 });
    await rejects(asUser(c2, badr, (c) => place(c, "T03", capSlot, tacoCart)), "slot_full");
    // A second cancels: 3 of 4, and the slot takes an order again.
    await asUser(c1, capOrders[3].customer, (c) => move(c, capOrders[3].id, "cancelled"));
    assert.deepEqual(await usageAt(badr, "T03", capSlot), { booked: 3, capacity: 4 });
    const fresh = await asUser(c2, badr, (c) => place(c, "T03", capSlot, tacoCart));
    assert.equal(fresh.status, "placed");
    assert.deepEqual(await usageAt(badr, "T03", capSlot), { booked: 4, capacity: 4 });
    return "5 of 4: all five kept, new orders refused; still refused at 4 of 4; accepted again at 3 of 4";
  });

  await check("an order already being placed when capacity is lowered is saved first, and stays", async () => {
    await beginAs(c1, others[5]);
    const inFlight = await place(c1, "T03", raceSlot, tacoCart); // holds the truck's row; not committed yet
    await beginAs(c2, tacoVendor);
    const lowering = c2.query("update public.trucks set slot_capacity = 1 where id = 'T03' returning slot_capacity").then(
      (result) => ({ ok: result.rows[0] }),
      (error) => ({ error }),
    );
    await waitUntilBlocked(admin, c2);
    await c1.query("commit");
    const outcome = await lowering;
    await c2.query("commit");
    assert.deepEqual(outcome.ok, { slot_capacity: 1 });
    const { rows } = await admin.query("select status::text as status from public.orders where id = $1", [inFlight.id]);
    assert.equal(rows[0].status, "placed");
    assert.deepEqual(await usageAt(badr, "T03", raceSlot), { booked: 1, capacity: 1 });
    // Put the truck back to its seeded capacity for the checks that follow.
    assert.deepEqual(await setCapacity(c1, tacoVendor, "T03", 6), [{ slot_capacity: 6 }]);
    return "the capacity change waited for the order, then saved; the order is 'placed' at 1 of 1; capacity restored to 6";
  });

  // -------------------------------------------------------------------------
  section("The customer ticket: cancelling against the kitchen, and rating once");

  await setClock("18:00");
  const freeSlots = async () =>
    (
      await admin.query(
        `select to_char(s, 'HH24:MI') as slot
         from (select time '19:00' + n * interval '15 minutes' as s from generate_series(0, 15) as n) as slots
         where (select count(*) from public.orders o where o.truck_id = 'T03' and o.service_date = $1 and o.slot_start = s
                and o.status not in ('rejected', 'cancelled')) <= 2
         order by s`,
        [today],
      )
    ).rows.map((r) => r.slot);
  const statusOf = async (id) => (await admin.query("select status::text as status from public.orders where id = $1", [id])).rows[0].status;
  const [cancelSlot] = await freeSlots();

  await check("a cancellation frees exactly one place, and the customer, the vendor and the manager all read it", async () => {
    const start = await slotCount("T03", cancelSlot);
    const mine = await asUser(c1, aisha, (c) => place(c, "T03", cancelSlot, tacoCart));
    const other = await asUser(c1, badr, (c) => place(c, "T03", cancelSlot, tacoCart));
    assert.equal(await slotCount("T03", cancelSlot), start + 2);
    // Only the customer who placed it can cancel it.
    await rejects(asUser(c1, badr, (c) => move(c, mine.id, "cancelled")), "order_not_found");
    await rejects(asUser(c1, tacoVendor, (c) => move(c, mine.id, "cancelled")), "transition_not_allowed");
    assert.equal((await asUser(c1, aisha, (c) => move(c, mine.id, "cancelled"))).status, "cancelled");
    assert.equal(await slotCount("T03", cancelSlot), start + 1); // one place, not two
    for (const reader of [aisha, tacoVendor, dana]) {
      const { rows } = await asUser(c1, reader, (c) => c.query("select status::text as status from public.orders where id = $1", [mine.id]));
      assert.deepEqual(rows, [{ status: "cancelled" }]);
      const usage = (await asUser(c1, reader, (c) => c.query("select booked from public.slot_usage('T03') where slot_start = $1", [cancelSlot]))).rows[0];
      assert.equal(usage.booked, start + 1);
    }
    assert.equal(await statusOf(other.id), "placed"); // the other customer's order is untouched
    // Cancelling twice, or after the kitchen has it, is refused.
    await rejects(asUser(c1, aisha, (c) => move(c, mine.id, "cancelled")), "transition_not_allowed");
    await asUser(c1, tacoVendor, (c) => move(c, other.id, "accepted"));
    await rejects(asUser(c1, badr, (c) => move(c, other.id, "cancelled")), "transition_not_allowed");
    return `${start + 2} places -> ${start + 1} after the cancellation; all three roles read 'cancelled' and ${start + 1}; an accepted order cannot be cancelled`;
  });

  await check("the vendor accepts first: the customer's cancellation waits, then is refused, and the order stays accepted", async () => {
    const [slot] = await freeSlots();
    const start = await slotCount("T03", slot);
    const order = await asUser(c1, aisha, (c) => place(c, "T03", slot, tacoCart));
    await beginAs(c1, tacoVendor);
    await move(c1, order.id, "accepted"); // holds the order's row; not committed yet
    await beginAs(c2, aisha);
    const cancelling = settled(move(c2, order.id, "cancelled"));
    await waitUntilBlocked(admin, c2);
    await c1.query("commit");
    const outcome = await cancelling;
    await c2.query("rollback");
    assert.equal(outcome.error?.message, "transition_not_allowed");
    assert.equal(await statusOf(order.id), "accepted");
    assert.equal(await slotCount("T03", slot), start + 1);
    return "cancellation waited for the acceptance, then transition_not_allowed; order 'accepted'; place still taken";
  });

  await check("the customer cancels first: the vendor's acceptance waits, then is refused, and the place is free", async () => {
    const [slot] = await freeSlots();
    const start = await slotCount("T03", slot);
    const order = await asUser(c1, aisha, (c) => place(c, "T03", slot, tacoCart));
    await beginAs(c1, aisha);
    await move(c1, order.id, "cancelled"); // not committed yet
    await beginAs(c2, tacoVendor);
    const accepting = settled(move(c2, order.id, "accepted"));
    await waitUntilBlocked(admin, c2);
    await c1.query("commit");
    const outcome = await accepting;
    await c2.query("rollback");
    assert.equal(outcome.error?.message, "transition_not_allowed");
    assert.equal(await statusOf(order.id), "cancelled");
    assert.equal(await slotCount("T03", slot), start);
    return "acceptance waited for the cancellation, then transition_not_allowed; order 'cancelled'; its place is free again";
  });

  await check("cancel and accept fired at the same instant: exactly one wins, five times out of five", async () => {
    const lines = [];
    for (let round = 0; round < 5; round += 1) {
      const [slot] = await freeSlots();
      const start = await slotCount("T03", slot);
      const order = await asUser(c1, aisha, (c) => place(c, "T03", slot, tacoCart));
      await beginAs(c1, aisha);
      await beginAs(c2, tacoVendor);
      const attempt = async (client, target) => {
        try {
          await move(client, order.id, target);
          await client.query("commit");
          return { target, won: true };
        } catch (error) {
          await client.query("rollback");
          return { target, won: false, reason: error.message };
        }
      };
      const pair = [() => attempt(c1, "cancelled"), () => attempt(c2, "accepted")];
      if (lines.length % 2 === 1) pair.reverse();
      const results = await Promise.all(pair.map((start) => start()));
      const winner = results.filter((r) => r.won);
      assert.equal(winner.length, 1);
      assert.equal(results.find((r) => !r.won).reason, "transition_not_allowed");
      const saved = await statusOf(order.id);
      assert.equal(saved, winner[0].target);
      assert.equal(await slotCount("T03", slot), saved === "cancelled" ? start : start + 1);
      lines.push(`${saved} (${saved === "cancelled" ? "place freed" : "place kept"})`);
    }
    return lines.join("; ");
  });

  // --- ratings -------------------------------------------------------------
  const rateSql = "select order_id, stars, comment from public.rate_order($1, $2, $3)";
  const rate = async (client, orderId, stars, comment = null) => (await client.query(rateSql, [orderId, stars, comment])).rows[0];
  const ratingCount = async (orderId) =>
    (await admin.query("select count(*)::int as n from public.order_ratings where order_id = $1", [orderId])).rows[0].n;
  let ratedOrder;

  await check("only the customer of a collected order can rate it, with 1 to 5 stars", async () => {
    const [slot] = await freeSlots();
    ratedOrder = await asUser(c1, aisha, (c) => place(c, "T03", slot, tacoCart));
    // Not collected yet: refused at every earlier status.
    await rejects(asUser(c1, aisha, (c) => rate(c, ratedOrder.id, 5)), "order_not_collected");
    for (const status of ["accepted", "preparing", "ready"]) {
      await asUser(c1, tacoVendor, (c) => move(c, ratedOrder.id, status));
      await rejects(asUser(c1, aisha, (c) => rate(c, ratedOrder.id, 5)), "order_not_collected");
    }
    await asUser(c1, tacoVendor, (c) => move(c, ratedOrder.id, "collected"));
    // Collected, but not theirs: another customer, the truck's vendor, the manager.
    for (const outsider of [badr, tacoVendor, dana]) {
      await rejects(asUser(c1, outsider, (c) => rate(c, ratedOrder.id, 5)), "order_not_found");
    }
    // Theirs, but not a real rating.
    for (const stars of [0, 6, -1, null]) await rejects(asUser(c1, aisha, (c) => rate(c, ratedOrder.id, stars)), "invalid_stars");
    await rejects(asUser(c1, aisha, (c) => rate(c, ratedOrder.id, 4, "x".repeat(501))), "comment_too_long");
    // A cancelled or rejected order can never be rated.
    const [other] = await freeSlots();
    const gone = await asUser(c1, aisha, (c) => place(c, "T03", other, tacoCart));
    await asUser(c1, aisha, (c) => move(c, gone.id, "cancelled"));
    await rejects(asUser(c1, aisha, (c) => rate(c, gone.id, 5)), "order_not_collected");
    assert.equal(await ratingCount(ratedOrder.id), 0);
    return "refused before collection, for anyone but the customer, outside 1 to 5, over 500 characters, and for a cancelled order";
  });

  await check("the rating is saved once: a second submission is refused and the first one stays", async () => {
    const saved = await asUser(c1, aisha, (c) => rate(c, ratedOrder.id, 4, "  Hot and fast.  "));
    assert.deepEqual(saved, { order_id: ratedOrder.id, stars: 4, comment: "Hot and fast." });
    await rejects(asUser(c1, aisha, (c) => rate(c, ratedOrder.id, 1, "changed my mind")), "already_rated");
    await rejects(asUser(c1, aisha, (c) => rate(c, ratedOrder.id, 4, "Hot and fast.")), "already_rated");
    const { rows } = await admin.query("select stars, comment from public.order_ratings where order_id = $1", [ratedOrder.id]);
    assert.deepEqual(rows, [{ stars: 4, comment: "Hot and fast." }]);
    // An empty comment is saved as no comment.
    const [slot] = await freeSlots();
    const quiet = await asUser(c1, badr, (c) => place(c, "T03", slot, tacoCart));
    for (const status of ["accepted", "preparing", "ready", "collected"]) await asUser(c1, tacoVendor, (c) => move(c, quiet.id, status));
    assert.deepEqual(await asUser(c1, badr, (c) => rate(c, quiet.id, 5, "   ")), { order_id: quiet.id, stars: 5, comment: null });
    return "4 stars and the trimmed comment saved; two more submissions got already_rated; still one row, unchanged";
  });

  await check("two submissions of a rating at the same instant save one rating, five times out of five", async () => {
    const lines = [];
    for (let round = 0; round < 5; round += 1) {
      const [slot] = await freeSlots();
      const order = await asUser(c1, aisha, (c) => place(c, "T03", slot, tacoCart));
      for (const status of ["accepted", "preparing", "ready", "collected"]) await asUser(c1, tacoVendor, (c) => move(c, order.id, status));
      await beginAs(c1, aisha);
      await beginAs(c2, aisha);
      const attempt = async (client, stars) => {
        try {
          await rate(client, order.id, stars);
          await client.query("commit");
          return { stars, won: true };
        } catch (error) {
          await client.query("rollback");
          return { stars, won: false, reason: error.message };
        }
      };
      const results = await Promise.all([attempt(c1, 5), attempt(c2, 3)]);
      const winner = results.filter((r) => r.won);
      assert.equal(winner.length, 1);
      assert.equal(results.find((r) => !r.won).reason, "already_rated");
      const { rows } = await admin.query("select stars from public.order_ratings where order_id = $1", [order.id]);
      assert.deepEqual(rows, [{ stars: winner[0].stars }]);
      lines.push(`${winner[0].stars} stars saved`);
    }
    return lines.join(", ") + "; the other submission got already_rated each time";
  });

  await check("a rating can be read by its customer, the truck's vendor and the manager, and written by nobody directly", async () => {
    const read = async (user) =>
      (await asUser(c1, user, (c) => c.query("select count(*)::int as n from public.order_ratings where order_id = $1", [ratedOrder.id]))).rows[0].n;
    assert.equal(await read(aisha), 1);
    assert.equal(await read(tacoVendor), 1);
    assert.equal(await read(dana), 1);
    assert.equal(await read(badr), 0); // another customer
    assert.equal(await read(duneVendor), 0); // another truck's vendor
    // No direct writes, even to your own rating.
    await rejects(asUser(c1, aisha, (c) => c.query("update public.order_ratings set stars = 5 where order_id = $1", [ratedOrder.id])), "42501");
    await rejects(asUser(c1, aisha, (c) => c.query("delete from public.order_ratings where order_id = $1", [ratedOrder.id])), "42501");
    await rejects(
      asUser(c1, badr, (c) =>
        c.query("insert into public.order_ratings (order_id, customer_id, truck_id, stars, rated_at) values ($1, auth.uid(), 'T03', 1, now())", [ratedOrder.id]),
      ),
      "42501",
    );
    // The table itself refuses a second rating and stars outside 1 to 5, whoever asks.
    await rejects(
      admin.query("insert into public.order_ratings (order_id, customer_id, truck_id, stars, rated_at) values ($1, $2, 'T03', 2, now())", [ratedOrder.id, aisha]),
      "23505",
    );
    await rejects(admin.query("update public.order_ratings set stars = 6 where order_id = $1", [ratedOrder.id]), "23514");
    return "read by customer, vendor and manager only; update, delete and insert through the API are refused; the table refuses a duplicate and 6 stars";
  });

  // -------------------------------------------------------------------------
  section("The vendor's menu: photo suggestions are limited, and Save changes two fields only");

  const dish = async (id) =>
    (
      await admin.query(
        "select id, name, category, price_kwd::text as price, sold_out, description, allergens from public.menu_items where id = $1",
        [id],
      )
    ).rows[0];
  const begin = (client, id) => client.query("select public.begin_ai_suggestion($1) as answer", [id]);
  const saveCopy = (client, id, description, allergens) =>
    client.query("select * from public.save_menu_copy($1, $2, $3::text[])", [id, description, allergens]);
  const asked = async (vendor) =>
    (await admin.query("select count(*)::int as n from public.ai_suggestion_requests where vendor_id = $1", [vendor])).rows[0].n;

  await check("only a vendor can start a photo suggestion, and only for a dish on their own truck", async () => {
    await setClock("17:00");
    const before = await dish("M203");
    const ok = await asUser(c1, duneVendor, (c) => begin(c, "M203"));
    assert.deepEqual(ok.rows[0].answer, { item_id: "M203", item_name: "Truffle smash", category: "Burgers", remaining: 19 });

    await rejects(asUser(c1, tacoVendor, (c) => begin(c, "M203")), "not_your_dish"); // Dune Burgers' dish
    await rejects(asUser(c1, duneVendor, (c) => begin(c, "M999")), "not_your_dish"); // no such dish
    await rejects(asUser(c1, aisha, (c) => begin(c, "M203")), "not_a_vendor"); // a customer
    await rejects(asUser(c1, dana, (c) => begin(c, "M203")), "not_a_vendor"); // the manager is not a vendor
    // Nobody signed in: the API's signed-out role may not even call it.
    await c1.query("begin");
    await c1.query("set local role anon");
    await rejects(c1.query("select public.begin_ai_suggestion('M203')"), "42501");
    await c1.query("rollback");

    assert.equal(await asked(duneVendor), 1);
    assert.equal(await asked(tacoVendor), 0);
    assert.deepEqual(await dish("M203"), before, "starting a suggestion never touches the dish");
    return "the truck's vendor is counted once; another vendor, a customer, the manager and a signed-out caller are refused and not counted";
  });

  await check("a vendor gets 20 suggestions an hour; the 21st is refused until the oldest is an hour old", async () => {
    for (let n = 2; n <= 20; n += 1) {
      const { rows } = await asUser(c1, duneVendor, (c) => begin(c, "M205"));
      assert.equal(rows[0].answer.remaining, 20 - n);
    }
    const refused = await rejects(asUser(c1, duneVendor, (c) => begin(c, "M203")), "rate_limited");
    assert.match(refused.detail, /^\d{4}-\d\d-\d\dT15:00:00Z$/, "it says when the next one is allowed (6:00 PM Kuwait)");
    assert.equal(await asked(duneVendor), 20, "a refused request is not counted");

    // The limit is per vendor: Taco Saha's vendor is unaffected.
    const other = await asUser(c1, tacoVendor, (c) => begin(c, "M301"));
    assert.equal(other.rows[0].answer.remaining, 19);

    await setClock("17:59");
    await rejects(asUser(c1, duneVendor, (c) => begin(c, "M203")), "rate_limited");
    await setClock("18:01");
    const again = await asUser(c1, duneVendor, (c) => begin(c, "M203"));
    assert.equal(again.rows[0].answer.remaining, 19);
    return "requests 1 to 20 pass, 21 is refused with the time it reopens, another vendor is unaffected, and an hour later it works again";
  });

  await check("Save changes the description and allergens, and leaves price, sold-out, name and category alone", async () => {
    const before = await dish("M203");
    assert.equal(before.description, null);
    assert.deepEqual(before.allergens, []);

    const { rows } = await asUser(c1, duneVendor, (c) =>
      saveCopy(c, "M203", "  Smashed beef patty with  truffle mayo and swiss.  ", ["milk", "gluten", "milk"]),
    );
    assert.equal(rows[0].description, "Smashed beef patty with truffle mayo and swiss.");
    assert.deepEqual(rows[0].allergens, ["gluten", "milk"], "no repeats, in the fixed list's order");

    const after = await dish("M203");
    assert.deepEqual(
      { ...after, description: null, allergens: [] },
      before,
      "nothing else on the dish changed",
    );
    assert.equal(after.price, "2.750");
    assert.equal(after.sold_out, false);

    // Customers (and signed-out visitors) read the saved text straight away.
    const seen = await asUser(c1, aisha, (c) => c.query("select description, allergens from public.menu_items where id = 'M203'"));
    assert.deepEqual(seen.rows[0], { description: "Smashed beef patty with truffle mayo and swiss.", allergens: ["gluten", "milk"] });

    // A sold-out dish keeps its sold-out switch too.
    await admin.query("update public.menu_items set sold_out = true where id = 'M203'");
    await asUser(c1, duneVendor, (c) => saveCopy(c, "M203", "Smashed beef, truffle mayo, swiss.", ["gluten", "milk", "egg"]));
    assert.equal((await dish("M203")).sold_out, true);
    assert.equal((await dish("M203")).price, "2.750");
    await admin.query("update public.menu_items set sold_out = false where id = 'M203'");

    // A blank description is saved as none.
    await asUser(c1, duneVendor, (c) => saveCopy(c, "M203", "   ", []));
    assert.equal((await dish("M203")).description, null);
    return "price 2.750 and sold-out are untouched; text is trimmed; allergens are de-duplicated; customers read the saved text";
  });

  await check("nobody else can save a dish, and nothing outside the rules is stored", async () => {
    const before = await dish("M203");
    await rejects(asUser(c1, tacoVendor, (c) => saveCopy(c, "M203", "Free burgers", [])), "not_your_dish");
    await rejects(asUser(c1, aisha, (c) => saveCopy(c, "M203", "Free burgers", [])), "not_your_dish");
    await rejects(asUser(c1, dana, (c) => saveCopy(c, "M203", "Free burgers", [])), "not_your_dish");
    await rejects(asUser(c1, duneVendor, (c) => saveCopy(c, "M301", "Not my truck", [])), "not_your_dish");
    await rejects(asUser(c1, duneVendor, (c) => saveCopy(c, "M203", "x".repeat(201), [])), "description_too_long");
    await rejects(asUser(c1, duneVendor, (c) => saveCopy(c, "M203", "Fine", ["price_kwd=0"])), "unknown_allergen");

    // Allergens cannot be written around the function either.
    await rejects(
      asUser(c1, duneVendor, (c) => c.query("update public.menu_items set allergens = '{milk}' where id = 'M203'")),
      "42501",
    );
    // The request log cannot be read or cleared through the API.
    await rejects(asUser(c1, duneVendor, (c) => c.query("select * from public.ai_suggestion_requests")), "42501");
    await rejects(asUser(c1, duneVendor, (c) => c.query("delete from public.ai_suggestion_requests")), "42501");

    assert.deepEqual(await dish("M203"), before);
    assert.deepEqual((await dish("M301")).description, null);
    return "another vendor, a customer and the manager are refused; 201 characters and an unknown allergen are refused; M203 is unchanged";
  });

  // Leave the fixture as the seed had it.
  await admin.query("update public.menu_items set description = null, allergens = '{}' where id = 'M203'");
  await admin.query("delete from public.ai_suggestion_requests");

  // -------------------------------------------------------------------------
  section("Online payment: paid only when the gateway's answer matches the saved order");

  await setClock("18:00");
  const SERVER_SECRET = "test-only-server-secret-0123456789abcdef"; // exists only in this throwaway database
  await admin.query(
    "insert into private.server_keys (name, secret_hash) values ('payments', encode(sha256(convert_to($1, 'UTF8')), 'hex'))",
    [SERVER_SECRET],
  );
  const PAY_SLOT = "22:30";
  // Dune Burgers is closed for tonight by this point in the story, so the
  // 3.200 KWD order here is Taco Saha's: one Halloumi taco and two Elote cups.
  const paidCart = [
    { item_id: "M303", quantity: 1 },
    { item_id: "M304", quantity: 2 },
  ];
  const placePaying = async (client, method, requestId = randomUUID()) =>
    (
      await client.query(
        "select id, ticket_ref, status, payment_method, payment_status, total_kwd::text as total_kwd from public.place_order_paying($1, $2::time, $3::jsonb, $4::uuid, $5)",
        ["T03", PAY_SLOT, JSON.stringify(paidCart), requestId, method],
      )
    ).rows[0];
  const paySlot = async () =>
    (await admin.query("select booked from public.slot_usage('T03') where slot_start = $1::time", [PAY_SLOT])).rows[0].booked;
  const payState = async (orderId) =>
    (await admin.query("select status::text, payment_method, payment_status, total_kwd::text as total, paid_at from public.orders where id = $1", [orderId])).rows[0];
  // What our server does after the gateway makes a payment page.
  const recordPage = (client, secret, orderId, invoice) =>
    client.query("select * from public.record_payment_page($1, $2, $3, $4)", [secret, orderId, invoice, `https://demo.example/pay/${invoice}`]);
  // What our server does with the gateway's answer about one invoice.
  const settleAs = async (client, secret, invoice, fact) =>
    (
      await client.query("select public.settle_payment($1, $2, $3, $4, $5, $6, $7, $8) as answer", [
        secret,
        invoice,
        fact.paymentId ?? `PAY-${invoice}`,
        fact.invoice ?? "PAID",
        fact.txn ?? "SUCCESS",
        fact.amount ?? 3.2,
        fact.currency ?? "KWD",
        fact.order,
      ])
    ).rows[0].answer;
  const paymentRows = async (orderId) =>
    (await admin.query("select invoice_id, status from public.order_payments where order_id = $1 order by id", [orderId])).rows;

  let paidOrder;
  await check("Pay online places one order and takes one place; a retry adds nothing", async () => {
    const before = await paySlot();
    const requestId = randomUUID();
    const first = await asUser(c1, aisha, (c) => placePaying(c, "online", requestId));
    const again = await asUser(c1, aisha, (c) => placePaying(c, "online", requestId));
    const thirdTime = await asUser(c1, aisha, (c) => placePaying(c, "pay_at_pickup", requestId));
    assert.equal(again.id, first.id);
    assert.equal(thirdTime.id, first.id);
    assert.deepEqual(
      { method: first.payment_method, paid: first.payment_status, total: first.total_kwd, status: first.status },
      { method: "online", paid: "unpaid", total: "3.200", status: "placed" },
    );
    assert.equal(thirdTime.payment_method, "online", "the saved order keeps the method it was saved with");
    assert.equal(await paySlot(), before + 1, "one place, however many times the request arrives");
    await rejects(asUser(c1, aisha, (c) => placePaying(c, "free")), "invalid_payment_method");
    await rejects(asUser(c1, aisha, (c) => placePaying(c, null)), "invalid_payment_method");
    assert.equal(await paySlot(), before + 1);
    paidOrder = first;
    return `${first.ticket_ref}: online, unpaid, 3.200; ${PAY_SLOT} went from ${before} to ${before + 1} and stayed there after two retries`;
  });

  await check("a customer cannot mark their own order paid", async () => {
    const id = paidOrder.id;
    await rejects(asUser(c1, aisha, (c) => c.query("update public.orders set payment_status = 'paid' where id = $1", [id])), "42501");
    await rejects(asUser(c1, aisha, (c) => recordPage(c, "guess", id, "INV-FAKE")), "not_the_server");
    await rejects(asUser(c1, aisha, (c) => recordPage(c, null, id, "INV-FAKE")), "not_the_server");
    await rejects(asUser(c1, aisha, (c) => settleAs(c, "guess-guess-guess-guess-guess-guess-guess", "INV-FAKE", { order: id })), "not_the_server");
    await rejects(asUser(c1, aisha, (c) => c.query("insert into public.order_payments (order_id, customer_id, invoice_id, amount_kwd, payment_url, created_at) values ($1, $2, 'X', 3.2, 'https://x', now())", [id, aisha])), "42501");
    await rejects(asUser(c1, aisha, (c) => c.query("select * from private.server_keys")), "42501");
    assert.equal((await payState(id)).payment_status, "unpaid");
    assert.deepEqual(await paymentRows(id), []);
    return "direct update, both server functions without the secret, a hand-made payment row and reading the secret's hash are all refused; still unpaid";
  });

  await check("the amount to charge comes from the saved order, and only its own customer can start paying", async () => {
    const id = paidOrder.id;
    const begun = (await asUser(c1, aisha, (c) => c.query("select public.begin_online_payment($1) as a", [id]))).rows[0].a;
    assert.equal(Number(begun.amount_kwd), 3.2);
    assert.equal(begun.currency, "KWD");
    assert.equal(begun.open_payment_url, null);
    await rejects(asUser(c1, badr, (c) => c.query("select public.begin_online_payment($1)", [id])), "order_not_found");
    await rejects(asUser(c1, tacoVendor, (c) => c.query("select public.begin_online_payment($1)", [id])), "order_not_found");
    const pickup = await asUser(c1, aisha, (c) => placePaying(c, "pay_at_pickup"));
    await rejects(asUser(c1, aisha, (c) => c.query("select public.begin_online_payment($1)", [pickup.id])), "not_online_order");
    await asUser(c1, aisha, (c) => move(c, pickup.id, "cancelled"));
    return "3.200 KWD read from the order; another customer and the vendor get order_not_found; a pay-at-pickup order cannot be paid online";
  });

  await check("the kitchen cannot accept an online order until it is paid, but can still see it", async () => {
    const id = paidOrder.id;
    await rejects(asUser(c1, tacoVendor, (c) => move(c, id, "accepted")), "payment_not_confirmed");
    const seen = await asUser(c1, tacoVendor, (c) => c.query("select payment_method, payment_status from public.orders where id = $1", [id]));
    assert.deepEqual(seen.rows[0], { payment_method: "online", payment_status: "unpaid" });
    assert.equal((await payState(id)).status, "placed");
    return "accept is refused with payment_not_confirmed; the vendor reads online / unpaid";
  });

  await check("a gateway answer that does not match the order never marks it paid", async () => {
    const id = paidOrder.id;
    const slot = await paySlot();
    for (const invoice of ["INV-A", "INV-B", "INV-C", "INV-D", "INV-E", "INV-F", "INV-G"]) await recordPage(admin, SERVER_SECRET, id, invoice);
    const again = (await asUser(c1, aisha, (c) => c.query("select public.begin_online_payment($1) as a", [id]))).rows[0].a;
    assert.equal(again.open_payment_url, "https://demo.example/pay/INV-G", "a recent payment page is reused, not made again");

    const other = randomUUID();
    assert.equal((await settleAs(admin, SERVER_SECRET, "INV-A", { order: id, amount: 3.199 })).payment, "mismatch"); // paid, wrong amount
    assert.equal((await settleAs(admin, SERVER_SECRET, "INV-B", { order: id, currency: "USD" })).payment, "mismatch"); // paid, wrong currency
    assert.equal((await settleAs(admin, SERVER_SECRET, "INV-C", { order: other })).payment, "mismatch"); // paid, for another order
    assert.equal((await settleAs(admin, SERVER_SECRET, "INV-D", { order: id, invoice: "PENDING", txn: "FAILED" })).payment, "failed");
    assert.equal((await settleAs(admin, SERVER_SECRET, "INV-E", { order: id, invoice: "CANCELED", txn: "CANCELED" })).payment, "cancelled");
    const pending = await settleAs(admin, SERVER_SECRET, "INV-F", { order: id, invoice: "PENDING", txn: "INPROGRESS" });
    assert.deepEqual({ payment: pending.payment, changed: pending.changed }, { payment: "created", changed: false });
    await rejects(settleAs(admin, SERVER_SECRET, "INV-NOT-OURS", { order: id }), "unknown_invoice");
    // A decided invoice stays decided, even if a "paid" answer arrives for it later.
    assert.deepEqual((await settleAs(admin, SERVER_SECRET, "INV-A", { order: id })).payment, "mismatch");

    assert.equal((await payState(id)).payment_status, "unpaid");
    assert.equal((await payState(id)).paid_at, null);
    assert.equal(await paySlot(), slot, "none of this touches the slot");
    return "wrong amount, wrong currency and another order's ID are 'mismatch'; failed, cancelled and pending leave it unpaid; an unknown invoice is refused";
  });

  await check("a matching answer marks it paid once; repeating the answer changes nothing", async () => {
    const id = paidOrder.id;
    const slot = await paySlot();
    const first = await settleAs(admin, SERVER_SECRET, "INV-F", { order: id });
    assert.deepEqual(first, { order_id: id, payment: "paid", payment_status: "paid", changed: true });
    const paidAt = (await payState(id)).paid_at;
    for (let n = 0; n < 3; n += 1) {
      // The return page reloaded, the notification arriving twice, "Check payment" tapped.
      const repeat = await settleAs(admin, SERVER_SECRET, "INV-F", { order: id });
      assert.deepEqual(repeat, { order_id: id, payment: "paid", payment_status: "paid", changed: false });
    }
    // Two answers at the same instant.
    const both = await Promise.all([settleAs(c1, SERVER_SECRET, "INV-F", { order: id }), settleAs(c2, SERVER_SECRET, "INV-F", { order: id })]);
    assert.deepEqual(both.map((b) => b.changed), [false, false]);
    // A second, different invoice that was also paid is recorded as a duplicate, not as a second payment.
    assert.equal((await settleAs(admin, SERVER_SECRET, "INV-G", { order: id })).payment, "duplicate");

    const state = await payState(id);
    assert.deepEqual({ paid: state.payment_status, status: state.status, total: state.total }, { paid: "paid", status: "placed", total: "3.200" });
    assert.equal(String(state.paid_at), String(paidAt), "paid_at did not move");
    assert.equal((await paymentRows(id)).filter((r) => r.status === "paid").length, 1);
    assert.equal(await paySlot(), slot);
    await rejects(asUser(c1, aisha, (c) => c.query("select public.begin_online_payment($1)", [id])), "already_paid");
    await rejects(recordPage(admin, SERVER_SECRET, id, "INV-LATE"), "order_not_payable");
    // Now the kitchen can accept it.
    assert.equal((await asUser(c1, tacoVendor, (c) => move(c, id, "accepted"))).status, "accepted");
    return "paid once; five more answers (two at the same instant) changed nothing; a second paid invoice is 'duplicate'; one paid row; slot count unchanged; then accepted";
  });

  await check("a failed try does not close the invoice: a later successful try on it still pays the order", async () => {
    const order = await asUser(c1, badr, (c) => placePaying(c, "online"));
    await recordPage(admin, SERVER_SECRET, order.id, "INV-T1");
    const failed = await settleAs(admin, SERVER_SECRET, "INV-T1", { order: order.id, invoice: "PENDING", txn: "FAILED", paymentId: "TRY-1" });
    assert.deepEqual({ payment: failed.payment, changed: failed.changed }, { payment: "failed", changed: true });
    // The same failed answer again, and a still-pending second try: nothing changes.
    assert.equal((await settleAs(admin, SERVER_SECRET, "INV-T1", { order: order.id, invoice: "PENDING", txn: "FAILED", paymentId: "TRY-1" })).changed, false);
    const pending = await settleAs(admin, SERVER_SECRET, "INV-T1", { order: order.id, invoice: "PENDING", txn: "INPROGRESS", paymentId: "TRY-2" });
    assert.deepEqual({ payment: pending.payment, changed: pending.changed }, { payment: "failed", changed: false });
    assert.equal((await payState(order.id)).payment_status, "unpaid");
    // The second try succeeds.
    const paid = await settleAs(admin, SERVER_SECRET, "INV-T1", { order: order.id, paymentId: "TRY-2" });
    assert.deepEqual({ payment: paid.payment, status: paid.payment_status, changed: paid.changed }, { payment: "paid", status: "paid", changed: true });
    // An old failed answer arriving late does not undo it.
    assert.equal((await settleAs(admin, SERVER_SECRET, "INV-T1", { order: order.id, invoice: "PAID", txn: "FAILED", paymentId: "TRY-1" })).payment, "paid");
    assert.equal((await payState(order.id)).payment_status, "paid");
    await asUser(c1, badr, (c) => move(c, order.id, "cancelled"));
    return `${order.ticket_ref}: failed, then pending (still unpaid), then paid; a late failed answer changes nothing`;
  });

  await check("a paid order that is rejected or cancelled shows Refund due, and its place is freed", async () => {
    // Rejected by the vendor after paying.
    const rejected = await asUser(c1, badr, (c) => placePaying(c, "online"));
    await recordPage(admin, SERVER_SECRET, rejected.id, "INV-R1");
    await settleAs(admin, SERVER_SECRET, "INV-R1", { order: rejected.id });
    const slot = await paySlot();
    await asUser(c1, tacoVendor, (c) => move(c, rejected.id, "rejected", "Out of buns"));
    assert.deepEqual(
      { status: (await payState(rejected.id)).status, paid: (await payState(rejected.id)).payment_status },
      { status: "rejected", paid: "refund_due" },
    );
    assert.equal(await paySlot(), slot - 1);
    const seen = await asUser(c1, badr, (c) => c.query("select payment_status from public.orders where id = $1", [rejected.id]));
    assert.equal(seen.rows[0].payment_status, "refund_due");

    // Cancelled by the customer after paying.
    const cancelled = await asUser(c1, badr, (c) => placePaying(c, "online"));
    await recordPage(admin, SERVER_SECRET, cancelled.id, "INV-R2");
    await settleAs(admin, SERVER_SECRET, "INV-R2", { order: cancelled.id });
    await asUser(c1, badr, (c) => move(c, cancelled.id, "cancelled"));
    assert.equal((await payState(cancelled.id)).payment_status, "refund_due");

    // Cancelled first, and the payment arrives afterwards.
    const late = await asUser(c1, badr, (c) => placePaying(c, "online"));
    await recordPage(admin, SERVER_SECRET, late.id, "INV-R3");
    await asUser(c1, badr, (c) => move(c, late.id, "cancelled"));
    assert.equal((await payState(late.id)).payment_status, "unpaid");
    assert.equal((await settleAs(admin, SERVER_SECRET, "INV-R3", { order: late.id })).payment_status, "refund_due");

    // An unpaid order that is rejected owes nothing.
    const unpaid = await asUser(c1, badr, (c) => placePaying(c, "online"));
    await asUser(c1, tacoVendor, (c) => move(c, unpaid.id, "rejected", "Closing early"));
    assert.equal((await payState(unpaid.id)).payment_status, "unpaid");
    return `${rejected.ticket_ref} paid then rejected: refund_due and ${PAY_SLOT} ${slot} -> ${slot - 1}; paid then cancelled: refund_due; cancelled then paid: refund_due; unpaid then rejected: unpaid`;
  });

  await check("pay at pickup works as before, and payment rows are private", async () => {
    const pickup = await asUser(c1, badr, (c) => place(c, "T03", PAY_SLOT, paidCart));
    assert.deepEqual(
      { method: (await payState(pickup.id)).payment_method, paid: (await payState(pickup.id)).payment_status },
      { method: "pay_at_pickup", paid: "unpaid" },
    );
    assert.equal((await asUser(c1, tacoVendor, (c) => move(c, pickup.id, "accepted"))).status, "accepted");
    // The table itself refuses "paid" on a pay-at-pickup order.
    await rejects(admin.query("update public.orders set payment_status = 'paid' where id = $1", [pickup.id]), "23514");

    const count = async (who) => (await asUser(c1, who, (c) => c.query("select count(*)::int as n from public.order_payments"))).rows[0].n;
    const all = (await admin.query("select count(*)::int as n from public.order_payments")).rows[0].n;
    const aishas = (await admin.query("select count(*)::int as n from public.order_payments where customer_id = $1", [aisha])).rows[0].n;
    assert.equal(await count(aisha), aishas);
    assert.equal(await count(tacoVendor), 0);
    assert.equal(await count(dana), all);
    assert.ok(aishas > 0 && all > aishas);
    return `old place_order: pay_at_pickup, unpaid, accepted normally; payment rows: customer reads own ${aishas}, vendor 0, manager all ${all}`;
  });

  // -------------------------------------------------------------------------
  section("The vendor's controls: details, open or closed, price and sold out, on their own truck only");

  // Karak Corner (T01) is still open at this point in the story and its menu
  // is as seeded. Its vendor is new. A pickup time nobody has used is chosen.
  await setClock("18:00");
  const karakVendor = await signUp("karak.vendor@qafla.test", { role: "vendor" });
  await admin.query("update public.trucks set vendor_id = $1 where id = 'T01'", [karakVendor]);
  const KARAK_SLOT = (
    await admin.query(
      `select to_char(s, 'HH24:MI') as slot
       from (select time '19:00' + n * interval '15 minutes' as s from generate_series(0, 15) as n) as slots
       where not exists (select 1 from public.orders o where o.truck_id = 'T01' and o.service_date = $1 and o.slot_start = s)
       order by s limit 1`,
      [today],
    )
  ).rows[0].slot;
  const toasties = [{ item_id: "M103", quantity: 2 }]; // Cheese and zaatar toastie, 0.750 KWD each as seeded
  const truckRow = async (id) => (await admin.query("select name, cuisine, blurb, is_open, slot_capacity from public.trucks where id = $1", [id])).rows[0];
  const dishRow = async (id) => (await admin.query("select price_kwd::text as price, sold_out, name, description from public.menu_items where id = $1", [id])).rows[0];
  const editTruck = (user, id, set, value) =>
    asUser(c1, user, async (c) => (await c.query(`update public.trucks set ${set} = $2 where id = $1 returning id`, [id, value])).rows.length);
  const editDish = (user, id, set, value) =>
    asUser(c1, user, async (c) => (await c.query(`update public.menu_items set ${set} = $2 where id = $1 returning id`, [id, value])).rows.length);
  const linesOf = async (orderId) =>
    (await admin.query("select item_id, quantity, unit_price_kwd::text as unit from public.order_items where order_id = $1 order by item_id", [orderId])).rows;
  const totalOf = async (orderId) => (await admin.query("select total_kwd::text as total from public.orders where id = $1", [orderId])).rows[0].total;

  await check("a vendor edits their own truck's details; everyone else changes nothing", async () => {
    const before = await truckRow("T01");
    assert.equal(await editTruck(karakVendor, "T01", "name", "Karak Corner Express"), 1);
    assert.equal(await editTruck(karakVendor, "T01", "cuisine", "Karak and bites"), 1);
    assert.equal(await editTruck(karakVendor, "T01", "blurb", "Hot karak, poured to order."), 1);
    assert.deepEqual(await truckRow("T01"), { ...before, name: "Karak Corner Express", cuisine: "Karak and bites", blurb: "Hot karak, poured to order." });
    // Another truck's vendor, the manager and a customer: the update matches no row they may change.
    for (const outsider of [tacoVendor, duneVendor, dana, badr]) {
      assert.equal(await editTruck(outsider, "T01", "name", "Taken over"), 0);
      assert.equal(await editTruck(outsider, "T01", "is_open", false), 0);
    }
    // And this vendor on somebody else's truck.
    const taco = await truckRow("T03");
    assert.equal(await editTruck(karakVendor, "T03", "name", "Karak Two"), 0);
    assert.equal(await editTruck(karakVendor, "T03", "is_open", false), 0);
    assert.deepEqual(await truckRow("T03"), taco);
    assert.equal((await truckRow("T01")).name, "Karak Corner Express");
    // The columns that decide whose truck it is cannot be written at all.
    await rejects(editTruck(karakVendor, "T01", "vendor_id", tacoVendor), "42501");
    await rejects(editTruck(karakVendor, "T01", "id", "T99"), "42501");
    return "name, cuisine and description saved; 4 outsiders changed nothing; this vendor changed nothing on T03; vendor_id and id are refused (42501)";
  });

  await check("truck details must be short, single-line and not blank", async () => {
    const before = await truckRow("T01");
    for (const bad of ["", "   ", " Karak", "Karak ", "x".repeat(41), "Karak\nCorner", "Karak\tCorner"]) await rejects(editTruck(karakVendor, "T01", "name", bad), "23514");
    for (const bad of ["", "x".repeat(31), "Tea\nand snacks"]) await rejects(editTruck(karakVendor, "T01", "cuisine", bad), "23514");
    for (const bad of ["x".repeat(121), "line one\nline two", " padded "]) await rejects(editTruck(karakVendor, "T01", "blurb", bad), "23514");
    // The edges are allowed: 40, 30 and 120 characters, an empty description, Arabic text.
    assert.equal(await editTruck(karakVendor, "T01", "name", "x".repeat(40)), 1);
    assert.equal(await editTruck(karakVendor, "T01", "cuisine", "x".repeat(30)), 1);
    assert.equal(await editTruck(karakVendor, "T01", "blurb", "x".repeat(120)), 1);
    assert.equal(await editTruck(karakVendor, "T01", "blurb", ""), 1);
    // (Arabic is checked in the unit tests and the browser: this throwaway
    // database on Windows is not a UTF-8 one, unlike Supabase.)
    assert.equal(await editTruck(karakVendor, "T01", "name", "Karak Café & Co"), 1);
    // Back to the seeded details for the rest of the story.
    await admin.query("update public.trucks set name = 'Karak Corner', cuisine = 'Tea and snacks', blurb = 'Karak, toasties and quick bites.' where id = 'T01'");
    assert.equal((await truckRow("T01")).is_open, before.is_open);
    return "blank, padded, too long and multi-line are refused (23514); 40 / 30 / 120 characters, an empty description and an accented name are saved";
  });

  let earlier; // the order placed before the price change
  await check("a vendor changes the price of their own dish only, and it must be a real price", async () => {
    assert.deepEqual(await dishRow("M103"), { price: "0.750", sold_out: false, name: "Cheese and zaatar toastie", description: null });
    earlier = await asUser(c1, aisha, (c) => place(c, "T01", KARAK_SLOT, toasties));
    assert.equal(earlier.total_kwd, "1.500");
    // Nobody else, and not on another truck's dish.
    for (const outsider of [tacoVendor, duneVendor, dana, badr]) assert.equal(await editDish(outsider, "M103", "price_kwd", "0.001"), 0);
    const tacoBefore = (await dishRow("M301")).price;
    assert.equal(await editDish(karakVendor, "M301", "price_kwd", "0.001"), 0);
    assert.equal((await dishRow("M103")).price, "0.750");
    assert.equal((await dishRow("M301")).price, tacoBefore);
    // Not free, not negative, not 1000 or more.
    for (const bad of ["0", "0.000", "-0.750", "1000", "1000.000"]) await rejects(editDish(karakVendor, "M103", "price_kwd", bad), "23514");
    // A fourth decimal is not kept: the column holds exactly three.
    assert.equal(await editDish(karakVendor, "M103", "price_kwd", "0.8004"), 1);
    assert.equal((await dishRow("M103")).price, "0.800");
    assert.equal(await editDish(karakVendor, "M103", "price_kwd", "999.999"), 1);
    assert.equal(await editDish(karakVendor, "M103", "price_kwd", "0.900"), 1);
    assert.deepEqual(await dishRow("M103"), { price: "0.900", sold_out: false, name: "Cheese and zaatar toastie", description: null });
    return "0.750 -> 0.900 by its own vendor; 4 outsiders and another truck's dish unchanged; 0, a negative price and 1000 refused (23514); 0.8004 is stored as 0.800";
  });

  await check("a new order uses the new price; the earlier ticket keeps the price it was placed at", async () => {
    const later = await asUser(c1, badr, (c) => place(c, "T01", KARAK_SLOT, toasties));
    assert.equal(later.total_kwd, "1.800"); // 2 x 0.900
    assert.deepEqual(await linesOf(later.id), [{ item_id: "M103", quantity: 2, unit: "0.900" }]);
    // The earlier order: same lines, same total, although the menu now says 0.900.
    assert.deepEqual(await linesOf(earlier.id), [{ item_id: "M103", quantity: 2, unit: "0.750" }]);
    assert.equal(await totalOf(earlier.id), "1.500");
    // A price sent by the browser is still ignored.
    const cheeky = await asUser(c1, others[0], (c) => place(c, "T01", KARAK_SLOT, [{ item_id: "M103", quantity: 1, price: 0.001, unit_price_kwd: 0.001 }]));
    assert.equal(cheeky.total_kwd, "0.900");
    return `${earlier.ticket_ref} stays 2 x 0.750 = 1.500; ${later.ticket_ref} is 2 x 0.900 = 1.800; a price sent by the browser is ignored (0.900)`;
  });

  await check("sold out: the order is refused and nothing is saved; back on sale, it is accepted", async () => {
    const before = await totals();
    const booked = await slotCount("T01", KARAK_SLOT);
    for (const outsider of [tacoVendor, dana, badr]) assert.equal(await editDish(outsider, "M102", "sold_out", true), 0);
    assert.equal((await dishRow("M102")).sold_out, false);
    assert.equal(await editDish(karakVendor, "M102", "sold_out", true), 1);
    // A cart with one sold-out dish among others is refused whole.
    const mixed = [
      { item_id: "M104", quantity: 1 },
      { item_id: "M102", quantity: 1 },
    ];
    await rejects(asUser(c1, others[1], (c) => place(c, "T01", KARAK_SLOT, mixed)), "item_sold_out");
    assert.deepEqual(await totals(), before);
    assert.equal(await slotCount("T01", KARAK_SLOT), booked);
    // The price and everything else about the dish is untouched by the switch.
    assert.deepEqual(await dishRow("M102"), { price: "0.350", sold_out: true, name: "Saffron karak", description: null });
    assert.equal(await editDish(karakVendor, "M102", "sold_out", false), 1);
    const ok = await asUser(c1, others[1], (c) => place(c, "T01", KARAK_SLOT, mixed));
    assert.equal(ok.total_kwd, "0.850"); // 0.500 + 0.350
    assert.equal(await slotCount("T01", KARAK_SLOT), booked + 1);
    return "outsiders cannot switch it; sold out -> item_sold_out, no order and no place taken; back on sale -> placed at 0.850";
  });

  await check("the vendor switches the truck off: no new orders, and every existing ticket can still be finished", async () => {
    const before = await totals();
    const booked = await slotCount("T01", KARAK_SLOT);
    assert.equal(await editTruck(karakVendor, "T01", "is_open", false), 1);
    await rejects(asUser(c1, others[2], (c) => place(c, "T01", KARAK_SLOT, toasties)), "truck_closed");
    assert.deepEqual(await totals(), before);
    assert.equal(await slotCount("T01", KARAK_SLOT), booked);
    // Nothing happened to the tickets, and the kitchen works through one from start to finish.
    assert.equal((await admin.query("select count(*)::int as n from public.orders where truck_id = 'T01' and slot_start = $1::time and status = 'placed'", [KARAK_SLOT])).rows[0].n, booked);
    for (const next of ["accepted", "preparing", "ready", "collected"]) {
      assert.equal((await asUser(c1, karakVendor, (c) => move(c, earlier.id, next))).status, next);
    }
    // The customer of another ticket can still cancel it, and that frees its place.
    const mine = (await admin.query("select id from public.orders where truck_id = 'T01' and slot_start = $2::time and customer_id = $1 and status = 'placed'", [badr, KARAK_SLOT])).rows[0].id;
    assert.equal((await asUser(c1, badr, (c) => move(c, mine, "cancelled"))).status, "cancelled");
    assert.equal(await slotCount("T01", KARAK_SLOT), booked - 1);
    // Switched back on: orders are taken again.
    assert.equal(await editTruck(karakVendor, "T01", "is_open", true), 1);
    const again = await asUser(c1, others[2], (c) => place(c, "T01", KARAK_SLOT, toasties));
    assert.equal(again.status, "placed");
    return `off -> truck_closed and nothing saved; ${earlier.ticket_ref} still went placed -> collected; a customer still cancelled; on again -> ${again.ticket_ref} placed`;
  });

  await check("Dana's Close for tonight wins over the vendor's switch, and is not the vendor's to undo", async () => {
    await asUser(c1, dana, (c) => c.query(closeSql, ["T01"]));
    // The two are stored apart: the vendor's switch still says open.
    assert.equal((await truckRow("T01")).is_open, true);
    await rejects(asUser(c1, others[3], (c) => place(c, "T01", KARAK_SLOT, toasties)), "truck_closed");
    // Switching off and on again changes nothing about tonight.
    assert.equal(await editTruck(karakVendor, "T01", "is_open", false), 1);
    assert.equal(await editTruck(karakVendor, "T01", "is_open", true), 1);
    await rejects(asUser(c1, others[3], (c) => place(c, "T01", KARAK_SLOT, toasties)), "truck_closed");
    // The vendor cannot remove, change or add a closure, and cannot call the manager's function.
    await rejects(asUser(c1, karakVendor, (c) => c.query("delete from public.truck_closures where truck_id = 'T01'")), "42501");
    await rejects(asUser(c1, karakVendor, (c) => c.query("update public.truck_closures set service_date = service_date - 1 where truck_id = 'T01'")), "42501");
    await rejects(asUser(c1, karakVendor, (c) => c.query(closeSql, ["T03"])), "not_a_manager");
    assert.equal((await admin.query("select count(*)::int as n from public.truck_closures where truck_id = 'T01' and service_date = $1", [today])).rows[0].n, 1);
    // Tonight's tickets are still the kitchen's to finish.
    const open = (await admin.query("select id from public.orders where truck_id = 'T01' and slot_start = $1::time and status = 'placed' order by placed_at limit 1", [KARAK_SLOT])).rows[0].id;
    for (const next of ["accepted", "preparing", "ready", "collected"]) {
      assert.equal((await asUser(c1, karakVendor, (c) => move(c, open, next))).status, next);
    }
    // The vendor can still edit the menu while closed.
    assert.equal(await editDish(karakVendor, "M103", "price_kwd", "0.750"), 1);
    assert.deepEqual(await dishRow("M103"), { price: "0.750", sold_out: false, name: "Cheese and zaatar toastie", description: null });
    return "closed by the manager with the vendor's switch still on: orders refused; the vendor cannot touch the closure (42501, not_a_manager); a ticket still went placed -> collected";
  });

  // -------------------------------------------------------------------------
  section("Dana's dashboard: every count is explained by tickets she can read");

  await check("for all 6 trucks and 24 times, the manager's tickets add up to slot_usage's count", async () => {
    const result = await asUser(c1, dana, async (c) => {
      // What the dashboard lists: tonight's orders, minus rejected and cancelled.
      const tickets = (
        await c.query(
          `select truck_id, slot_start::text as slot, count(*)::int as n from public.orders
           where service_date = $1 and ${QUALIFYING} group by 1, 2`,
          [today],
        )
      ).rows;
      const listed = new Map(tickets.map((r) => [`${r.truck_id} ${r.slot}`, r.n]));
      // What the dashboard prints: the database's own count.
      let cells = 0;
      let busy = 0;
      for (const truck of ["T01", "T02", "T03", "T04", "T05", "T06"]) {
        const { rows } = await c.query("select slot_start::text as slot, booked from public.slot_usage($1)", [truck]);
        assert.equal(rows.length, 24);
        for (const row of rows) {
          assert.equal(row.booked, listed.get(`${truck} ${row.slot}`) ?? 0, `${truck} ${row.slot}`);
          cells += 1;
          if (row.booked > 0) busy += 1;
        }
      }
      const statuses = (
        await c.query("select status::text as status, count(*)::int as n from public.orders where service_date = $1 group by 1", [today])
      ).rows;
      return { cells, busy, statuses: Object.fromEntries(statuses.map((r) => [r.status, r.n])) };
    });
    assert.equal(result.cells, 144);
    assert.ok(result.busy > 0);
    // The comparison only means something if each kind of order is present.
    assert.ok(result.statuses.collected > 0 && result.statuses.rejected > 0 && result.statuses.cancelled > 0);
    return `144 cells checked, ${result.busy} with orders; collected ${result.statuses.collected} counted, rejected ${result.statuses.rejected} and cancelled ${result.statuses.cancelled} left out`;
  });

  await check("the same dashboard read by a customer or a vendor returns only their own orders", async () => {
    const read = (user) =>
      asUser(c1, user, async (c) => ({
        role: (await c.query("select role::text as role from public.profiles where id = auth.uid()")).rows[0].role,
        seen: (await c.query("select count(*)::int as n from public.orders where service_date = $1", [today])).rows[0].n,
        notMine: (
          await c.query(
            "select count(*)::int as n from public.orders where service_date = $1 and customer_id <> auth.uid() and truck_id is distinct from private.my_truck_id()",
            [today],
          )
        ).rows[0].n,
      }));
    const all = (await totals()).orders;
    const manager = await read(dana);
    const customer = await read(badr);
    const vendor = await read(tacoVendor);
    assert.equal(manager.role, "manager");
    assert.equal(manager.seen, all);
    assert.equal(customer.notMine, 0);
    assert.equal(vendor.notMine, 0);
    assert.ok(customer.seen < all && vendor.seen < all);
    return `manager reads ${manager.seen} of ${all}; customer ${customer.seen}, vendor ${vendor.seen}, none of them someone else's`;
  });

  await check("closing a truck answers with the saved closure; a second tap changes nothing; everyone can read it", async () => {
    const before = await totals();
    const close = () =>
      asUser(c1, dana, async (c) => (await c.query("select truck_id, closed_at from public.close_truck_for_tonight('T03')")).rows[0]);
    const first = await close();
    const second = await close();
    assert.equal(first.truck_id, "T03");
    assert.ok(first.closed_at instanceof Date);
    assert.deepEqual(second, first);
    await rejects(asUser(c1, tacoVendor, (c) => c.query("select public.close_truck_for_tonight('T04')")), "not_a_manager");
    const { rows } = await asUser(c2, badr, (c) =>
      c.query("select count(*)::int as n from public.truck_closures where truck_id = 'T03' and service_date = $1", [today]),
    );
    assert.equal(rows[0].n, 1);
    assert.deepEqual(await totals(), before); // closing touches no order
    return "one closure row for T03, same closed_at both times; a vendor is refused; orders untouched";
  });

  // -------------------------------------------------------------------------
  section("Account: a user changes their own display name, and nothing else");

  await check("set_my_name changes the caller's own name only; the role stays out of reach", async () => {
    const profile = async (id) => (await admin.query("select role::text as role, display_name from public.profiles where id = $1", [id])).rows[0];
    const setName = (user, value) => asUser(c1, user, async (c) => (await c.query("select public.set_my_name($1) as name", [value])).rows[0].name);
    const danaBefore = await profile(dana);
    assert.equal(await setName(aisha, "  Aisha   Al-Sabah \n"), "Aisha Al-Sabah"); // tidied to one line
    assert.deepEqual(await profile(aisha), { role: "customer", display_name: "Aisha Al-Sabah" });
    assert.deepEqual(await profile(dana), danaBefore); // nobody else's row moved
    assert.equal(await setName(aisha, "x".repeat(60)), "x".repeat(60));
    await rejects(setName(aisha, "x".repeat(61)), "name_too_long");
    assert.equal(await setName(aisha, "   "), null); // an empty name clears it
    assert.equal((await profile(aisha)).display_name, null);
    // The direct routes are still closed: no UPDATE on profiles at all, so no role change.
    await rejects(asUser(c1, aisha, (c) => c.query("update public.profiles set display_name = 'x' where id = $1", [aisha])), "42501");
    await rejects(asUser(c1, aisha, (c) => c.query("update public.profiles set role = 'manager' where id = $1", [aisha])), "42501");
    // Not signed in: refused.
    await c1.query("begin");
    await c1.query("set local role anon");
    await rejects(c1.query("select public.set_my_name('x')"), "42501");
    await c1.query("rollback");
    assert.equal((await profile(aisha)).role, "customer");
    return "own name tidied and saved, 61 characters refused, empty clears it; direct updates of name or role are still refused (42501); anon is refused";
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
