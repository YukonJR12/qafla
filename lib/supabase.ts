import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Only the project URL and the publishable key are used. Both are safe to
// ship to a browser: what a visitor may read or change is decided by the
// database's own rules (grants and row-level security), not by hiding a key.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireConfig(): { url: string; key: string } {
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in the project URL and publishable key.",
    );
  }
  return { url, key };
}

let browserClient: SupabaseClient | undefined;

/**
 * The client the browser uses. It keeps the signed-in customer's session in
 * this browser's storage and sends it with every request, so `place_order`
 * knows who is ordering.
 */
export function supabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    const config = requireConfig();
    browserClient = createClient(config.url, config.key);
  }
  return browserClient;
}

/**
 * A client for the server to act AS one signed-in user, given the access
 * token their browser sent. Every read and function call through it goes
 * through the database's own rules for that user, exactly as it would from
 * their browser. It holds no special key and stores nothing.
 */
export function supabaseAs(accessToken: string): SupabaseClient {
  const config = requireConfig();
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * A signed-out client for the server to read public data (trucks, menus,
 * slot counts). It never holds a session.
 */
export function supabasePublic(): SupabaseClient {
  const config = requireConfig();
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
