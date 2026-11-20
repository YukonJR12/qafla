"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCart } from "./cart";
import { resolveCart, type CartLine } from "./cart-lines";
import { fetchMenu, type MenuItem } from "./data";
import { sumKwd } from "./money";
import { supabaseBrowser } from "./supabase";

export type { CartLine };

/**
 * - loading: the browser's cart or the truck's menu has not arrived yet
 * - error:   the menu could not be read; the saved cart is untouched
 * - empty:   there is no cart
 * - ready:   the cart was matched against the menu (see `missingIds`, `soldOut`)
 */
export type CartStatus = "loading" | "error" | "empty" | "ready";

type MenuRead = { truckId: string; attempt: number; menu: MenuItem[] | null };

/**
 * Turns the stored cart (IDs and quantities) into lines with names and
 * prices by reading that truck's menu. The total shown before ordering is a
 * preview; the server works out the real one when the order is placed.
 */
export function useCartLines() {
  const { cart, ready } = useCart();
  const truckId = cart?.truckId;
  const [attempt, setAttempt] = useState(0);
  // menu === null inside a finished read means "the read failed".
  const [read, setRead] = useState<MenuRead | null>(null);

  useEffect(() => {
    if (!truckId) return;
    let live = true;
    fetchMenu(supabaseBrowser(), truckId)
      .then((menu) => {
        if (live) setRead({ truckId, attempt, menu });
      })
      .catch(() => {
        if (live) setRead({ truckId, attempt, menu: null });
      });
    return () => {
      live = false;
    };
  }, [truckId, attempt]);

  /** Read the menu again after a failure. The cart is not touched. */
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return useMemo(() => {
    const current = read && read.truckId === truckId && read.attempt === attempt ? read : null;
    const status: CartStatus = !ready
      ? "loading"
      : !cart
        ? "empty"
        : !current
          ? "loading"
          : current.menu === null
            ? "error"
            : "ready";

    const resolved = resolveCart(cart?.items ?? {}, current?.menu ?? []);
    return {
      status,
      ...resolved,
      orderable: status === "ready" && resolved.orderable,
      total: sumKwd(resolved.lines.map((l) => ({ price: l.item.price_kwd, quantity: l.quantity }))),
      retry,
    };
  }, [cart, read, ready, truckId, attempt, retry]);
}
