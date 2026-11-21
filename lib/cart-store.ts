// Where the cart is kept in this browser, with no React in it, so the
// "one cart per account" rule can be unit-tested.
//
// Each account has its own storage key, and the saved cart also names its
// owner. Someone else signing in on the same phone reads a different key,
// so they never see, change or order the previous person's cart. Signing
// out does not delete a cart: it is there again when its owner returns.

export type Cart = {
  /** The signed-in account this cart belongs to. */
  ownerId?: string;
  truckId: string;
  /** Canonical (English) truck name, kept so the cart can name its truck anywhere. */
  truckName: string;
  /** item id -> quantity (1 to 10) */
  items: Record<string, number>;
  /** The pickup slot chosen at checkout, e.g. "19:15:00". */
  slot: string | null;
  /** How the customer explicitly chose to pay. Unset means no choice yet. */
  payment?: "pay_at_pickup" | "online";
  /**
   * The ID of the checkout attempt for exactly these dishes and this time.
   * It is created when the customer taps "Place order" and thrown away the
   * moment the dishes or the time change. Sending the same ID again lets
   * the database recognise a retry and return the order it already saved.
   */
  requestId?: string | null;
  /** The signed-in customer that ID was made for. Nobody else may reuse it. */
  requestBy?: string | null;
};

/** The part of localStorage this file uses, so tests can pass a fake one. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * The key every visitor shared before sign-in came first. A cart saved
 * there has no owner, so it is thrown away rather than handed to whoever
 * signs in next.
 */
export const LEGACY_CART_KEY = "qafla.cart.v1";

export const cartKey = (userId: string) => `qafla.cart.v2.${userId}`;

/** The saved text for this account's cart, or null. Signed out means no cart. */
export function readCartRaw(store: KeyValueStore | null, userId: string | null): string | null {
  if (!store || !userId) return null;
  try {
    return store.getItem(cartKey(userId));
  } catch {
    return null; // private mode or blocked storage: behave as an empty cart
  }
}

/** Turns saved text into a cart, but only if it says it belongs to this account. */
export function parseCart(raw: string | null, userId: string | null): Cart | null {
  if (!raw || !userId) return null;
  try {
    const cart = JSON.parse(raw) as Cart;
    return cart && cart.ownerId === userId && typeof cart.truckId === "string" && cart.items ? cart : null;
  } catch {
    return null;
  }
}

export function readCart(store: KeyValueStore | null, userId: string | null): Cart | null {
  return parseCart(readCartRaw(store, userId), userId);
}

/** Saves this account's cart. An empty cart (or null) removes it. Signed out: nothing happens. */
export function writeCart(store: KeyValueStore | null, userId: string | null, cart: Cart | null) {
  if (!store || !userId) return;
  try {
    if (cart && Object.keys(cart.items).length > 0) {
      store.setItem(cartKey(userId), JSON.stringify({ ...cart, ownerId: userId }));
    } else {
      store.removeItem(cartKey(userId));
    }
  } catch {
    // nothing to do; the cart just won't survive a refresh
  }
}

/** Removes the old shared cart, which has no owner. */
export function dropLegacyCart(store: KeyValueStore | null) {
  try {
    store?.removeItem(LEGACY_CART_KEY);
  } catch {
    // nothing to do
  }
}
