// Turns seed/trucks.csv and seed/menu_items.csv into supabase/seed.sql.
//
//   pnpm db:seed:build           rewrite supabase/seed.sql from the CSVs
//   pnpm db:seed:build --check   fail if seed.sql no longer matches the CSVs
//
// The CSVs stay the source of truth. seed.sql is generated so it can be run
// anywhere SQL runs: the Supabase SQL editor, the Supabase CLI, or psql.

import { readFileSync, writeFileSync } from "node:fs";
import { buildSeedSql, seedSqlPath } from "./lib/seed-csv.mjs";

const sql = buildSeedSql();

if (process.argv.includes("--check")) {
  const current = readFileSync(seedSqlPath, "utf8").replaceAll("\r\n", "\n");
  if (current !== sql) {
    console.error("supabase/seed.sql is out of date. Run: pnpm db:seed:build");
    process.exit(1);
  }
  console.log("supabase/seed.sql matches the CSVs.");
} else {
  writeFileSync(seedSqlPath, sql);
  console.log("Wrote supabase/seed.sql");
}
