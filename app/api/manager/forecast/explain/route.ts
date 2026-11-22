import { supabaseAs } from "@/lib/supabase";
import { rushHandler } from "@/lib/rush-explain";
import { askRushExplanation } from "@/lib/rush-openrouter";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;
// Reuse the existing server-only OpenRouter settings and chat/completions transport.
export const POST = rushHandler(async (token) => {
  const db = supabaseAs(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return false;
  const profile = await db
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  return !profile.error && profile.data?.role === "manager";
}, askRushExplanation);
