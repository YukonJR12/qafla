import { NextResponse } from "next/server";
import { MAX_PHOTO_BYTES, readSuggestion, SYSTEM_PROMPT, userPrompt, validPhoto, type SuggestProblem } from "@/lib/menu-ai";
import { supabaseAs } from "@/lib/supabase";

// POST /api/menu/suggest
//
// A vendor sends one photo of one of their dishes. This route, on the
// server, asks a vision model (through OpenRouter) for a short description
// and the allergens the dish may contain, and hands back a DRAFT.
//
// What it never does: it never writes to the menu. Saving is a separate
// step the vendor takes afterwards, and that step can only change the
// description and the allergens.
//
// The order of the steps matters:
//   1. Who is asking? The browser sends the vendor's own access token.
//   2. Is the photo something we accept?
//   3. The database decides (begin_ai_suggestion): is this a vendor, is the
//      dish on their own truck, and are they under 20 requests this hour?
//   4. Only then is the photo sent to OpenRouter.
//   5. The answer is cleaned (lib/menu-ai.ts): a short description and
//      allergens from our fixed list. Everything else is thrown away.
//
// The OpenRouter key is read here from the server's environment. It is not
// in any file the browser downloads.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

/** How long we wait for the model before giving up. */
const TIMEOUT_MS = 30_000;

const STATUS: Record<SuggestProblem, number> = {
  not_a_vendor: 401,
  not_your_dish: 403,
  rate_limited: 429,
  bad_photo: 400,
  ai_busy: 503,
  ai_failed: 502,
  no_suggestion: 422,
};

/** Text that is safe to put in a log: one line, short, and with anything key-shaped removed. */
function forLog(value: unknown): string {
  return String(value ?? "")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-[removed]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [removed]")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

export async function POST(request: Request) {
  // A short ID that appears in the log line AND in the vendor's error
  // message, so the two can be matched without logging who they are.
  const requestId = crypto.randomUUID().slice(0, 8);
  const started = Date.now();
  let vendor = "unknown";
  let itemId = "unknown";

  /** One refusal: a status code, a short code for the screen, and (for failures) a log line. */
  const refuse = (problem: SuggestProblem, extra: Record<string, unknown> = {}, log?: Record<string, unknown>) => {
    if (log) {
      // console.error goes to the server's log (Vercel's Logs tab). No photo,
      // no key and no email is ever written here.
      console.error(JSON.stringify({ event: "ai_suggest_failed", requestId, problem, itemId, vendor, ms: Date.now() - started, ...log }));
    }
    return NextResponse.json({ problem, requestId, ...extra }, { status: STATUS[problem] });
  };

  // 1. Who is asking?
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return refuse("not_a_vendor");
  const db = supabaseAs(token);
  const { data: who, error: whoError } = await db.auth.getUser(token);
  if (whoError || !who.user) return refuse("not_a_vendor");
  vendor = who.user.id.slice(0, 8);

  // 2. The photo.
  let photo: File | null = null;
  try {
    const form = await request.formData();
    itemId = String(form.get("itemId") ?? "").slice(0, 16);
    const file = form.get("photo");
    if (file instanceof File) photo = file;
  } catch {
    return refuse("bad_photo");
  }
  if (!/^M\d{3}$/.test(itemId)) return refuse("not_your_dish");
  if (!photo || !validPhoto(photo.type, photo.size) || photo.size > MAX_PHOTO_BYTES) return refuse("bad_photo");

  // 3. The database decides whether this vendor may ask about this dish now.
  const allowed = await db.rpc("begin_ai_suggestion", { p_item_id: itemId });
  if (allowed.error) {
    const code = allowed.error.message;
    if (code === "not_a_vendor" || code === "not_your_dish") return refuse(code);
    if (code === "rate_limited") return refuse("rate_limited", { retryAt: allowed.error.details ?? null });
    return refuse("ai_failed", {}, { stage: "permission_check", detail: forLog(code) });
  }
  const dish = allowed.data as { item_name: string; category: string; remaining: number };

  // 4. Ask the model.
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  const base = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  if (!key || !model) {
    return refuse("ai_failed", { remaining: dish.remaining }, { stage: "configuration", detail: !key ? "OPENROUTER_API_KEY is not set" : "OPENROUTER_MODEL is not set" });
  }

  const image = `data:${photo.type};base64,${Buffer.from(await photo.arrayBuffer()).toString("base64")}`;
  let answer: Response;
  try {
    answer = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Qafla Pickup" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt({ name: dish.item_name, category: dish.category }) },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return refuse("ai_failed", { remaining: dish.remaining }, { stage: "request", model, detail: timedOut ? "timed out" : forLog(error instanceof Error ? error.message : error) });
  }

  if (!answer.ok) {
    const body = await answer.text().catch(() => "");
    let detail = body;
    try {
      detail = JSON.parse(body)?.error?.message ?? body;
    } catch {
      // not JSON; log the start of whatever it was
    }
    // OpenRouter's own "too many requests" is a different message for the vendor.
    return refuse(answer.status === 429 ? "ai_busy" : "ai_failed", { remaining: dish.remaining }, { stage: "openrouter", model, status: answer.status, detail: forLog(detail) });
  }

  // 5. Keep a short description and known allergens. Throw the rest away.
  let content: unknown = null;
  try {
    const json = await answer.json();
    content = json?.choices?.[0]?.message?.content ?? null;
    if (Array.isArray(content)) content = content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
  } catch {
    content = null;
  }
  const suggestion = readSuggestion(content);
  if (!suggestion) {
    return refuse("no_suggestion", { remaining: dish.remaining }, { stage: "answer", model, detail: "no usable description in the answer" });
  }

  console.log(JSON.stringify({ event: "ai_suggest_ok", requestId, itemId, vendor, model, ms: Date.now() - started, allergens: suggestion.allergens.length }));
  return NextResponse.json({ suggestion, model, remaining: dish.remaining, requestId });
}
