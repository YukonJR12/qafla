"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAccount } from "./account";
import { dropLegacyCart, parseCart, readCart, readCartRaw, writeCart, type Cart, type KeyValueStore } from "./cart-store";

// The cart lives in this browser's localStorage, so it survives a refresh
// and a language switch.
//
// It belongs to the signed-in account (see cart-store.ts): each account has
// its own cart on this phone, and nobody sees anyone else's.
//
// It holds one truck and, per dish, an ID and a quantity. Prices are never
// stored here: screens read them from the menu, and the server prices the
// order itself when it is placed.

export type { Cart };

export const MAX_QUANTITY = 10;
const CHANGE_EVENT = "qafla-cart-change";

function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null; // private mode or blocked storage
  }
}

function write(userId: string | null, cart: Cart | null) {
  writeCart(browserStore(), userId, cart);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** This account's cart as stored right now, for code that runs outside a render. */
export function storedCart(userId: string | null): Cart | null {
  return readCart(browserStore(), userId);
}

/**
 * The request ID for this customer's cart exactly as it is now. The first
 * call makes one and saves it with the cart; later calls return the same
 * one until the dishes or the time change.
 */
export function requestIdForCart(customerId: string): string | null {
  const cart = storedCart(customerId);
  if (!cart) return null;
  if (cart.requestId && cart.requestBy === customerId) return cart.requestId;
  const requestId = crypto.randomUUID();
  write(customerId, { ...cart, requestId, requestBy: customerId });
  return requestId;
}

type CartApi = {
  /** null until the browser has loaded, when signed out, and whenever the cart is empty. */
  cart: Cart | null;
  /** false during server rendering and the first paint. */
  ready: boolean;
  count: number;
  /** Sets a dish's quantity in the cart for this truck. 0 removes it. */
  setQuantity: (truck: { id: string; name: string }, itemId: string, quantity: number) => void;
  /** Throws away the current cart and starts one for another truck. */
  replaceWith: (truck: { id: string; name: string }, itemId: string) => void;
  setSlot: (slot: string | null) => void;
  /** Remembers the payment choice with the cart. It is not part of what is ordered, so the attempt's ID stays. */
  setPayment: (payment: "pay_at_pickup" | "online") => void;
  /** Forget the current attempt's ID so the next "Place order" starts a new attempt. */
  forgetRequest: () => void;
  clear: () => void;
};

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { account } = useAccount();
  // Only a signed-in account has a cart. Everything below reads and writes
  // that account's own storage key.
  const userId = account.status === "signed-in" ? account.userId : null;

  // useSyncExternalStore reads localStorage after hydration, so the server
  // and the first browser paint agree (both see "not ready").
  const snapshot = useCallback(() => readCartRaw(browserStore(), userId), [userId]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const cart = useMemo(() => parseCart(raw, userId), [raw, userId]);

  // The cart everyone on this browser used to share has no owner. Drop it.
  useEffect(() => dropLegacyCart(browserStore()), []);

  // Every change to the dishes or the time drops requestId: it is a
  // different order now, so it must not reuse the old attempt's ID.

  const setQuantity = useCallback<CartApi["setQuantity"]>(
    (truck, itemId, quantity) => {
      const current = storedCart(userId);
      const base: Cart =
        current && current.truckId === truck.id
          ? current
          : { truckId: truck.id, truckName: truck.name, items: {}, slot: null };
      const items = { ...base.items };
      const next = Math.max(0, Math.min(MAX_QUANTITY, quantity));
      if (next === 0) delete items[itemId];
      else items[itemId] = next;
      write(userId, { ...base, items, requestId: null, requestBy: null });
    },
    [userId],
  );

  const replaceWith = useCallback<CartApi["replaceWith"]>(
    (truck, itemId) => {
      write(userId, { truckId: truck.id, truckName: truck.name, items: { [itemId]: 1 }, slot: null, requestId: null, requestBy: null });
    },
    [userId],
  );

  const setSlot = useCallback<CartApi["setSlot"]>(
    (slot) => {
      const current = storedCart(userId);
      if (current && current.slot !== slot) write(userId, { ...current, slot, requestId: null, requestBy: null });
    },
    [userId],
  );

  const setPayment = useCallback<CartApi["setPayment"]>(
    (payment) => {
      const current = storedCart(userId);
      if (current && current.payment !== payment) write(userId, { ...current, payment });
    },
    [userId],
  );

  const forgetRequest = useCallback(() => {
    const current = storedCart(userId);
    if (current?.requestId) write(userId, { ...current, requestId: null, requestBy: null });
  }, [userId]);

  const clear = useCallback(() => write(userId, null), [userId]);

  const api = useMemo<CartApi>(
    () => ({
      cart,
      ready,
      count: cart ? Object.values(cart.items).reduce((a, b) => a + b, 0) : 0,
      setQuantity,
      replaceWith,
      setSlot,
      setPayment,
      forgetRequest,
      clear,
    }),
    [cart, ready, setQuantity, replaceWith, setSlot, setPayment, forgetRequest, clear],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const api = useContext(CartContext);
  if (!api) throw new Error("useCart must be used inside <CartProvider>");
  return api;
}
