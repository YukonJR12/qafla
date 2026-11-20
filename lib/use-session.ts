"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase";

/**
 * The signed-in customer's Supabase session, or null for a visitor.
 * `loading` is true until the browser has checked its stored session.
 */
export function useSession(): { loading: boolean; session: Session | null } {
  const [state, setState] = useState<{ loading: boolean; session: Session | null }>({
    loading: true,
    session: null,
  });

  useEffect(() => {
    const db = supabaseBrowser();
    db.auth.getSession().then(({ data }) => setState({ loading: false, session: data.session }));
    const { data } = db.auth.onAuthStateChange((_event, session) => setState({ loading: false, session }));
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}
