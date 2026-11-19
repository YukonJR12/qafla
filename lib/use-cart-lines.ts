"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "./cart";
import { fetchMenu, type MenuItem } from "./data";
import { sumKwd } from "./money";
import { supabaseBrowser } from "./supabase";

export type CartLine = { item: MenuItem; quantity: number };

/**
 * Turns the stored cart (IDs and quantities) into lines with names and
 * prices by reading that truck's menu. The total shown before ordering is a
 * preview; the server works out the real one when the order is placed.
 */
export function useCartLines() {
  const { cart, ready } = useCart();
  const truckId = cart?.truckId;
  const [loaded, setLoaded] = useState<{ truckId: string; menu: MenuItem[] } | null>(null);

  useEffect(() => {
    if (!truckId) return;
    let live = true;
    fetchMenu(supabaseBrowser(), truckId)
      .then((menu) => {
        if (live) setLoaded({ truckId, menu });
      })
      .catch(() => {
        if (live) setLoaded({ truckId, menu: [] });
      });
    return () => {
      live = false;
    };
  }, [truckId]);

  return useMemo(() => {
    const menu = loaded && loaded.truckId === truckId ? loaded.menu : null;
    const lines: CartLine[] = [];
    if (cart && menu) {
      for (const item of menu) {
        const quantity = cart.items[item.id];
        if (quantity) lines.push({ item, quantity });
      }
    }
    return {
      lines,
      total: sumKwd(lines.map((l) => ({ price: l.item.price_kwd, quantity: l.quantity }))),
      /** true until the browser's cart and that truck's menu have both arrived */
      loading: !ready || (cart !== null && menu === null),
    };
  }, [cart, loaded, ready, truckId]);
}
