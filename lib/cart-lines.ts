import type { MenuItem } from "./data";

// Pure logic, no browser and no network, so it can be unit tested
// (tests/unit/cart-lines.test.ts).

export type CartLine = { item: MenuItem; quantity: number };

export type ResolvedCart = {
  /** Every saved dish that is still on the menu, in menu order. */
  lines: CartLine[];
  /** Saved item IDs that this truck's menu no longer has. */
  missingIds: string[];
  /** Lines whose dish is on the menu but marked sold out. */
  soldOut: CartLine[];
  /** True only when every saved dish was matched and none is sold out. */
  orderable: boolean;
};

/**
 * Matches the saved cart (item ID -> quantity) against the truck's menu.
 *
 * Nothing is dropped quietly: a saved dish that cannot be matched is
 * reported in `missingIds`, and `orderable` is false until the customer
 * has dealt with it. The order sent to the server is always the whole
 * saved cart, never just the lines that happened to match.
 */
export function resolveCart(items: Record<string, number>, menu: MenuItem[]): ResolvedCart {
  const lines: CartLine[] = [];
  const matched = new Set<string>();

  for (const item of menu) {
    const quantity = items[item.id];
    if (quantity) {
      lines.push({ item, quantity });
      matched.add(item.id);
    }
  }

  const missingIds = Object.keys(items).filter((id) => !matched.has(id));
  const soldOut = lines.filter((line) => line.item.sold_out);

  return {
    lines,
    missingIds,
    soldOut,
    orderable: lines.length > 0 && missingIds.length === 0 && soldOut.length === 0,
  };
}

/** What `place_order` receives: every saved dish, IDs and quantities only. */
export function orderItems(items: Record<string, number>): { item_id: string; quantity: number }[] {
  return Object.entries(items).map(([item_id, quantity]) => ({ item_id, quantity }));
}
