// Starts a throwaway Postgres 17 server, applies the real migrations and seed
// to it, and gives the tests a way to act as a signed-in user.
//
// Nothing here touches a Supabase project. The server lives in a temp folder
// and is deleted when the tests finish.

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const root = fileURLToPath(new URL("../../", import.meta.url));
const migrationsDir = join(root, "supabase", "migrations");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export async function startDatabase() {
  const port = await freePort();
  const server = new EmbeddedPostgres({
    databaseDir: mkdtempSync(join(tmpdir(), "qafla-pg-")),
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  await server.start();

  const config = { host: "127.0.0.1", port, user: "postgres", password: "postgres", database: "postgres" };
  const clients = [];
  const connect = async () => {
    const client = new pg.Client(config);
    await client.connect();
    // Supabase databases run in UTC. Do the same so nothing passes by
    // accident because this machine happens to be in Kuwait's time zone.
    await client.query("set time zone 'UTC'");
    clients.push(client);
    return client;
  };

  const admin = await connect();
  const applied = [];
  const apply = async (label, path) => {
    await admin.query(readFileSync(path, "utf8"));
    applied.push(label);
  };

  await apply("tests/db/supabase-shim.sql (test only)", join(root, "tests", "db", "supabase-shim.sql"));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await apply(`supabase/migrations/${file}`, join(migrationsDir, file));
  }
  await apply("tests/db/test-clock.sql (test only)", join(root, "tests", "db", "test-clock.sql"));
  await apply("supabase/seed.sql", join(root, "supabase", "seed.sql"));

  const version = (await admin.query("show server_version")).rows[0].server_version;

  return {
    admin,
    connect,
    applied,
    version,
    seedSql: readFileSync(join(root, "supabase", "seed.sql"), "utf8"),
    async stop() {
      await Promise.allSettled(clients.map((c) => c.end()));
      await server.stop();
    },
  };
}

/**
 * Puts a connection into the same state the Supabase API puts it in for a
 * signed-in request: a transaction, the `authenticated` role, and the user's
 * id in the request token. Pass null to act as a signed-out visitor.
 */
export async function beginAs(client, userId) {
  await client.query("begin");
  await client.query(`set local role ${userId ? "authenticated" : "anon"}`);
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "anon" }),
  ]);
}

/** One API request: begin as the user, run, commit. Any error rolls back. */
export async function asUser(client, userId, fn) {
  await beginAs(client, userId);
  try {
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

/** Asserts that the promise fails with the given error message or SQLSTATE. */
export async function rejects(promise, expected) {
  try {
    await promise;
  } catch (error) {
    if (error.message === expected || error.code === expected) return error;
    assert.fail(`expected "${expected}" but got "${error.message}" (${error.code})`);
  }
  assert.fail(`expected "${expected}" but the call succeeded`);
}

/** Resolves once the connection is stuck waiting for a lock. */
export async function waitUntilBlocked(admin, client) {
  for (let i = 0; i < 200; i += 1) {
    const { rows } = await admin.query(
      "select wait_event_type from pg_stat_activity where pid = $1",
      [client.processID],
    );
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.fail("the second transaction never waited for a lock");
}

// --- tiny reporter ---------------------------------------------------------

let passed = 0;

export function section(title) {
  console.log(`\n${title}`);
}

export async function check(name, fn) {
  try {
    const observed = await fn();
    passed += 1;
    console.log(`  PASS  ${name}${observed ? `\n        -> ${observed}` : ""}`);
  } catch (error) {
    console.log(`  FAIL  ${name}\n        ${error.message}`);
    throw error;
  }
}

export const passedCount = () => passed;
