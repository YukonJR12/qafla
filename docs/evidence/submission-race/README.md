# Five-round last-slot recording — isolated environment

Recorded 22 November 2026. [Side-by-side recording](five-round-race.webm) (22.2 seconds, 5 fps), original [Customer A](customer-a.webm) and [Customer B](customer-b.webm) recordings, and [machine-checked results](results.json).

Two independent Chromium browser contexts, each 390 × 844, with different customer sessions. This is Chrome emulation, not a physical phone. The combined video places A on the left and B on the right; recordings are approximately aligned at 5 fps, not timing telemetry. No events were rearranged; originals are retained.

## Fixture and boundary

Local production Next.js build on 127.0.0.1:3102. A disposable **real PostgreSQL 17** applies the shipped migrations and seed. Auth users, JWT claims and Kuwait time (15:00 on 22 Nov) use the existing test-only database shim. A Playwright HTTP adapter translates the app's Supabase requests into real database queries as the authenticated user. It does not fabricate successful orders or slot-full responses. It waits for both placement requests before releasing them onto separate database connections. This tests the database race and real checkout/ticket UI; it does **not** test hosted Supabase Auth, PostgREST or Realtime transport.

T02 has capacity 6. Each round starts with five fixture orders in a different slot. Both customers have one M201 Classic smash and explicitly configured pay-at-pickup. Green evidence captions show the count read from PostgreSQL; they are test annotations, not product UI. The database serializes placement on the truck-row lock and rechecks capacity. Each loser sees the actual checkout recovery with saved cart and another pickup-time option. No hosted database, Production orders or payments are involved.

| Round | Slot (Kuwait) | Before | Winner / confirmed ticket | Loser | After / gained | Screenshots |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 17:00 | 5/6 | A / T02-000006 | B: slot_full | 6/6 / +1 | [A](round-1-a-after.png), [B](round-1-b-after.png) |
| 2 | 17:15 | 5/6 | A / T02-000012 | B: slot_full | 6/6 / +1 | [A](round-2-a-after.png), [B](round-2-b-after.png) |
| 3 | 17:30 | 5/6 | B / T02-000018 | A: slot_full | 6/6 / +1 | [A](round-3-a-after.png), [B](round-3-b-after.png) |
| 4 | 17:45 | 5/6 | B / T02-000024 | A: slot_full | 6/6 / +1 | [A](round-4-a-after.png), [B](round-4-b-after.png) |
| 5 | 18:00 | 5/6 | A / T02-000030 | B: slot_full | 6/6 / +1 | [A](round-5-a-after.png), [B](round-5-b-after.png) |

Each matching `round-N-a-before.png` and `round-N-b-before.png` is also retained. Counts include orders whose status is neither rejected nor cancelled. The test database contains only this service date.

Reproduce: `pnpm test:browser tests/browser/submission-race.spec.mts`. Passed in 36.7 seconds including build; process exit **0**, no interrupt. Database teardown is awaited. The explicit `.mts` extension keeps the PostgreSQL harness in ESM.

**Assessment limit:** the supplied assessment says to run on the live link. This recording satisfies the requested controlled two-session exercise, but live-deployment race evidence remains pending unless CODED accepts this isolated setup.
