// Where each kind of account may go, with no browser or database in it, so
// it can be unit-tested.
//
// This file only decides which SCREEN to show. It is not what keeps data
// safe: the database's own rules (row-level security and the order
// functions) decide what every account can read or change, whatever
// address is typed.

export type Role = "customer" | "vendor" | "manager";

export const SIGN_IN = "/sign-in";

/** What the launch gate knows about whoever is using this browser. */
export type Who =
  | { status: "restoring" }
  /** `onPurpose` is true right after the user tapped "Sign out". */
  | { status: "signed-out"; onPurpose?: boolean }
  /** Signed in, but the profile could not be read. */
  | { status: "failed" }
  | { status: "signed-in"; role: Role; hasTruck: boolean };

export function isRole(value: unknown): value is Role {
  return value === "customer" || value === "vendor" || value === "manager";
}

/** The two kinds of account a person can create for themselves. The manager is never one of them. */
export type SignupRole = "customer" | "vendor";

/**
 * The role a new account asks for. Anything other than "vendor" is a
 * customer, which is also what the database's signup trigger does: it
 * accepts 'customer' or 'vendor' and turns everything else, including
 * 'manager', into 'customer'.
 */
export function signupRole(value: unknown): SignupRole {
  return value === "vendor" ? "vendor" : "customer";
}

/** The first screen of each workspace. */
export function homeFor(role: Role): string {
  return role === "vendor" ? "/vendor" : role === "manager" ? "/manager" : "/explore";
}

const CUSTOMER = ["/explore", "/trucks", "/cart", "/checkout", "/orders", "/account"];
const VENDOR = ["/vendor", "/account"];
const MANAGER = ["/manager", "/account"];

/** The path without its query or fragment. */
function pathOnly(path: string): string {
  return path.split(/[?#]/)[0];
}

/** May this role open this screen? Sub-pages count (e.g. /orders/<id>). */
export function mayOpen(role: Role, path: string): boolean {
  const clean = pathOnly(path);
  const areas = role === "vendor" ? VENDOR : role === "manager" ? MANAGER : CUSTOMER;
  return areas.some((area) => clean === area || clean.startsWith(`${area}/`));
}

/**
 * A "return to" address from the sign-in link, or null when it is not a
 * plain page inside this app. Anything that could leave the app
 * ("//evil.example", "https://…", a backslash trick) is refused.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const clean = pathOnly(value);
  return clean === "/" || clean === SIGN_IN ? null : value;
}

/** Where a fresh sign-in lands: the deep link if this role may open it, else its workspace. */
export function afterSignIn(role: Role, next: string | null | undefined): string {
  const wanted = safeNext(next);
  return wanted && mayOpen(role, wanted) ? wanted : homeFor(role);
}

/** The sign-in address that remembers where the visitor was going. */
export function signInUrl(from: string | null): string {
  const wanted = safeNext(from);
  return wanted ? `${SIGN_IN}?next=${encodeURIComponent(wanted)}` : SIGN_IN;
}

export type View =
  /** The logo on Snowy White: restoring the session, or on the way elsewhere. */
  | "splash"
  /** The page that was asked for. */
  | "page"
  /** A vendor account with no truck assigned. */
  | "unassigned"
  /** The profile could not be read. */
  | "failed";

/**
 * The one decision the launch gate makes: what to show for this account at
 * this address, and where to send it instead (or null to stay).
 */
export function route(who: Who, path: string, search = ""): { view: View; redirect: string | null } {
  const clean = pathOnly(path);

  if (who.status === "restoring") return { view: "splash", redirect: null };
  if (who.status === "failed") return { view: "failed", redirect: null };

  if (who.status === "signed-out") {
    if (clean === SIGN_IN) return { view: "page", redirect: null };
    // After "Sign out" the next person starts clean, not on the last person's page.
    const from = who.onPurpose || clean === "/" ? null : clean + search;
    return { view: "splash", redirect: signInUrl(from) };
  }

  // Signed in. A vendor without a truck has no workspace to open yet.
  if (who.role === "vendor" && !who.hasTruck) return { view: "unassigned", redirect: null };

  if (clean === "/" || clean === SIGN_IN) {
    const next = clean === SIGN_IN ? new URLSearchParams(search).get("next") : null;
    return { view: "splash", redirect: afterSignIn(who.role, next) };
  }
  if (!mayOpen(who.role, clean)) return { view: "splash", redirect: homeFor(who.role) };
  return { view: "page", redirect: null };
}

export type NavItem = { key: "explore" | "orders" | "account" | "kitchen" | "menu" | "capacity" | "overview" | "slot"; href: string };

/** The destinations each role's navigation offers, in order. */
export function navFor(role: Role): NavItem[] {
  if (role === "vendor") {
    return [
      { key: "kitchen", href: "/vendor" },
      { key: "menu", href: "/vendor/menu" },
      { key: "capacity", href: "/vendor/capacity" },
      { key: "account", href: "/account" },
    ];
  }
  if (role === "manager") {
    return [
      { key: "overview", href: "/manager" },
      { key: "slot", href: "/manager?view=slot" },
      { key: "account", href: "/account" },
    ];
  }
  return [
    { key: "explore", href: "/explore" },
    { key: "orders", href: "/orders" },
    { key: "account", href: "/account" },
  ];
}

/** Which navigation item is "here". `search` matters only for the manager's slot details. */
export function activeNav(role: Role, path: string, search = ""): NavItem["key"] | null {
  const clean = pathOnly(path);
  if (clean === "/account") return "account";
  if (role === "vendor") {
    if (clean === "/vendor/menu" || clean.startsWith("/vendor/menu/")) return "menu";
    return clean === "/vendor/capacity" ? "capacity" : clean === "/vendor" ? "kitchen" : null;
  }
  if (role === "manager") {
    if (clean !== "/manager") return null;
    const query = new URLSearchParams(search);
    return query.get("truck") || query.get("view") === "slot" ? "slot" : "overview";
  }
  if (clean === "/orders" || clean.startsWith("/orders/")) return "orders";
  // Choosing a truck, its menu, the cart and checkout are all part of ordering.
  return "explore";
}
