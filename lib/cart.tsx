"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

// The cart lives in this browser's localStorage, so it survives a refresh,
// a language switch and the trip through sign-in or signup.
//
// It holds one truck and, per dish, an ID and a quantity. Prices are never
// stored here: screens read them from the menu, and the server prices the
// order itself when it is placed.

export type Cart = {
  truckId: string;
  /** Canonical (English) truck name, kept so the cart can name its truck anywhere. */
  truckName: string;
  /** item id -> quantity (1 to 10) */
  items: Record<string, number>;
  /** The pickup slot chosen at checkout, e.g. "19:15:00". */
  slot: string | null;
  /**
   * The ID of the checkout attempt for exactly these dishes and this time.
   * It is created when the customer taps "Place order" and thrown away the
   * moment the dishes or the time change. Sending the same ID again lets
   * the database recognise a retry and return the order it already saved.
   */
  requestId?: string | null;
};

export const MAX_QUANTITY = 10;
const STORAGE_KEY = "qafla.cart.v1";
const CHANGE_EVENT = "qafla-cart-change";

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // private mode or blocked storage: behave as an empty cart
  }
}

function write(cart: Cart | null) {
  try {
    if (cart && Object.keys(cart.items).length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // nothing to do; the cart just won't survive a refresh
  }
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

function parse(raw: string | null): Cart | null {
  if (!raw) return null;
  try {
    const cart = JSON.parse(raw) as Cart;
    return cart && typeof cart.truckId === "string" && cart.items ? cart : null;
  } catch {
    return null;
  }
}

/** The cart as stored right now, for code that runs outside a render. */
export function storedCart(): Cart | null {
  return parse(read());
}

/**
 * The request ID for the cart exactly as it is now. The first call makes
 * one and saves it with the cart; later calls return the same one until
 * the dishes or the time change.
 */
export function requestIdForCart(): string | null {
  const cart = parse(read());
  if (!cart) return null;
  if (cart.requestId) return cart.requestId;
  const requestId = crypto.randomUUID();
  write({ ...cart, requestId });
  return requestId;
}

type CartApi = {
  /** null until the browser has loaded, and whenever the cart is empty. */
  cart: Cart | null;
  /** false during server rendering and the first paint. */
  ready: boolean;
  count: number;
  /** Sets a dish's quantity in the cart for this truck. 0 removes it. */
  setQuantity: (truck: { id: string; name: string }, itemId: string, quantity: number) => void;
  /** Throws away the current cart and starts one for another truck. */
  replaceWith: (truck: { id: string; name: string }, itemId: string) => void;
  setSlot: (slot: string | null) => void;
  /** Forget the current attempt's ID so the next "Place order" starts a new attempt. */
  forgetRequest: () => void;
  clear: () => void;
};

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  // useSyncExternalStore reads localStorage after hydration, so the server
  // and the first browser paint agree (both see "not ready").
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const cart = useMemo(() => parse(raw), [raw]);

  // Every change to the dishes or the time drops requestId: it is a
  // different order now, so it must not reuse the old attempt's ID.

  const setQuantity = useCallback<CartApi["setQuantity"]>((truck, itemId, quantity) => {
    const current = parse(read());
    const base: Cart =
      current && current.truckId === truck.id
        ? current
        : { truckId: truck.id, truckName: truck.name, items: {}, slot: null };
    const items = { ...base.items };
    const next = Math.max(0, Math.min(MAX_QUANTITY, quantity));
    if (next === 0) delete items[itemId];
    else items[itemId] = next;
    write({ ...base, items, requestId: null });
  }, []);

  const replaceWith = useCallback<CartApi["replaceWith"]>((truck, itemId) => {
    write({ truckId: truck.id, truckName: truck.name, items: { [itemId]: 1 }, slot: null, requestId: null });
  }, []);

  const setSlot = useCallback<CartApi["setSlot"]>((slot) => {
    const current = parse(read());
    if (current && current.slot !== slot) write({ ...current, slot, requestId: null });
  }, []);

  const forgetRequest = useCallback(() => {
    const current = parse(read());
    if (current?.requestId) write({ ...current, requestId: null });
  }, []);

  const clear = useCallback(() => write(null), []);

  const api = useMemo<CartApi>(
    () => ({
      cart,
      ready,
      count: cart ? Object.values(cart.items).reduce((a, b) => a + b, 0) : 0,
      setQuantity,
      replaceWith,
      setSlot,
      forgetRequest,
      clear,
    }),
    [cart, ready, setQuantity, replaceWith, setSlot, forgetRequest, clear],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const api = useContext(CartContext);
  if (!api) throw new Error("useCart must be used inside <CartProvider>");
  return api;
}
