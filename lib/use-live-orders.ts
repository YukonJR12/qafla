"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "./supabase";

/**
 * - connecting:   first connection, nothing has gone wrong
 * - live:         connected, and the saved state has been re-read since
 * - reconnecting: the connection dropped, or the re-read has not succeeded
 *                 yet. What is on screen is the last confirmed state.
 */
export type LiveState = "connecting" | "live" | "reconnecting";

/**
 * Keeps a screen in step with the `orders` table.
 *
 * A live message is only ever a nudge: "something changed". The screen then
 * calls `reread`, which reads the saved rows from the database again. So the
 * screen always shows what the database holds, never what a message claimed.
 *
 * `reread` also runs every time the connection is (re)established, when the
 * tab becomes visible again, and when the phone comes back online. A change
 * that happened while nobody was listening is picked up then.
 *
 * `filter` narrows which rows this screen is nudged about, e.g.
 * "truck_id=eq.T02" or "id=eq.<order id>". Who may see a row at all is
 * decided by the database's row-level security, not by this filter.
 */
export function useLiveOrders({
  enabled,
  channel,
  filter,
  reread,
}: {
  enabled: boolean;
  channel: string;
  filter: string;
  /** Re-reads the saved state. Must reject when the read fails. */
  reread: () => Promise<unknown>;
}): LiveState {
  const [state, setState] = useState<LiveState>("connecting");

  // Always call the newest `reread` without re-subscribing when it changes.
  const latest = useRef(reread);
  useEffect(() => {
    latest.current = reread;
  }, [reread]);

  useEffect(() => {
    if (!enabled) return;
    const db = supabaseBrowser();
    let stopped = false;
    let joined = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    // Re-read the saved state. Only a successful read while connected
    // counts as "live"; a failed one is tried again shortly.
    const sync = () => {
      clearTimeout(retry);
      latest.current().then(
        () => {
          if (!stopped && joined) setState("live");
        },
        () => {
          if (stopped) return;
          setState("reconnecting");
          retry = setTimeout(sync, 5000);
        },
      );
    };

    const subscription = db
      .channel(channel)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter }, sync)
      .subscribe((status) => {
        if (stopped) return;
        joined = status === "SUBSCRIBED";
        if (joined) sync(); // connected, or connected again: catch up
        else setState((was) => (was === "connecting" ? was : "reconnecting"));
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    const onOffline = () => setState("reconnecting");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", sync);
    window.addEventListener("offline", onOffline);

    return () => {
      stopped = true;
      clearTimeout(retry);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", onOffline);
      db.removeChannel(subscription);
    };
  }, [enabled, channel, filter]);

  return state;
}
