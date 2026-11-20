"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchMyProfile, fetchMyTruck, type Truck } from "./data";
import { isRole, type Role, type Who } from "./routes";
import { supabaseBrowser } from "./supabase";

// Who is using this browser, read once and shared with every screen.
//
// Step 1 restores the Supabase session this browser saved (or finds none).
// Step 2 reads that account's profile from the database: its role, its name
// and, for a vendor, the truck it runs. The role always comes from the
// database, never from anything stored in the browser.
//
// The launch gate uses this to choose a workspace. It is not what protects
// data: the database checks every read and every action by itself.

export type Account =
  | { status: "restoring" }
  | { status: "signed-out"; onPurpose: boolean }
  /** Signed in, but the profile could not be read (offline, or no profile). */
  | { status: "failed"; userId: string; email: string }
  | {
      status: "signed-in";
      userId: string;
      email: string;
      name: string | null;
      role: Role;
      /** The truck a vendor runs, or null: no truck is assigned to this vendor yet. */
      truck: Truck | null;
    };

type AccountApi = {
  account: Account;
  /** Signs this browser out. Other devices stay signed in. */
  signOut: () => Promise<void>;
  /** Reads the profile again (after a failure, or to check for a newly assigned truck). */
  retry: () => void;
};

const AccountContext = createContext<AccountApi | null>(null);

type Signed = { id: string; email: string } | null;

export function AccountProvider({ children }: { children: React.ReactNode }) {
  // undefined: the browser has not checked its saved session yet.
  const [user, setUser] = useState<Signed | undefined>(undefined);
  const [profile, setProfile] = useState<
    { userId: string; attempt: number; result: { name: string | null; role: Role; truck: Truck | null } | null } | null
  >(null);
  const [attempt, setAttempt] = useState(0);
  const leftOnPurpose = useRef(false);
  const [onPurpose, setOnPurpose] = useState(false);

  // Step 1: the saved session, and every later sign-in or sign-out
  // (including one made in another tab).
  useEffect(() => {
    const auth = supabaseBrowser().auth;
    const apply = (session: { user: { id: string; email?: string } } | null) => {
      const next = session ? { id: session.user.id, email: session.user.email ?? "" } : null;
      if (!next) {
        setOnPurpose(leftOnPurpose.current);
        leftOnPurpose.current = false;
      }
      // Keep the same object while the same account stays signed in, so a
      // refreshed token does not look like a new person.
      setUser((was) => (was && next && was.id === next.id ? was : next));
    };
    auth.getSession().then(({ data }) => apply(data.session));
    const { data } = auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  // Step 2: this account's profile, from the database.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let current = true;
    (async () => {
      const db = supabaseBrowser();
      const row = await fetchMyProfile(db, userId);
      if (!row || !isRole(row.role)) throw new Error("no_profile");
      const truck = row.role === "vendor" ? await fetchMyTruck(db, userId) : null;
      return { name: row.display_name, role: row.role, truck };
    })().then(
      (result) => current && setProfile({ userId, attempt, result }),
      () => current && setProfile({ userId, attempt, result: null }),
    );
    return () => {
      current = false;
    };
  }, [userId, attempt]);

  const account = useMemo<Account>(() => {
    if (user === undefined) return { status: "restoring" };
    if (!user) return { status: "signed-out", onPurpose };
    // Never show one account with another account's profile.
    const mine = profile && profile.userId === user.id && profile.attempt === attempt ? profile : null;
    if (!mine) return { status: "restoring" };
    if (!mine.result) return { status: "failed", userId: user.id, email: user.email };
    return { status: "signed-in", userId: user.id, email: user.email, ...mine.result };
  }, [user, profile, attempt, onPurpose]);

  const signOut = useCallback(async () => {
    leftOnPurpose.current = true;
    // "local" ends the session in this browser only.
    await supabaseBrowser().auth.signOut({ scope: "local" });
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const api = useMemo(() => ({ account, signOut, retry }), [account, signOut, retry]);
  return <AccountContext.Provider value={api}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountApi {
  const api = useContext(AccountContext);
  if (!api) throw new Error("useAccount must be used inside <AccountProvider>");
  return api;
}

/** The account as the routing rules see it (lib/routes.ts). */
export function whoIs(account: Account): Who {
  if (account.status === "signed-in") return { status: "signed-in", role: account.role, hasTruck: account.truck !== null };
  if (account.status === "signed-out") return { status: "signed-out", onPurpose: account.onPurpose };
  return { status: account.status };
}
