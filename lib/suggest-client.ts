"use client";

import type { Suggestion, SuggestProblem } from "./menu-ai";
import { supabaseBrowser } from "./supabase";

// The browser's side of a photo suggestion: shrink the photo, send it to
// our own server route with the vendor's access token, and sort the answer
// into "a draft" or "a problem". The browser never talks to the AI service
// and never holds its key.

export type SuggestResult =
  | { ok: true; suggestion: Suggestion; model: string; remaining: number | null }
  | { ok: false; problem: SuggestProblem; requestId: string | null; retryAt: string | null; remaining: number | null };

/** The longest side a photo is sent at. Plenty for recognising a dish, and quick to upload. */
const MAX_SIDE = 1280;

/**
 * Makes a phone photo small enough to send: at most 1280 px on its longest
 * side, as a JPEG. If the browser cannot do that, the original is sent and
 * the server decides whether to accept it.
 */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    // A white backing, so a transparent PNG does not turn black as a JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Asks our server for a draft. Never throws: every failure comes back as a problem. */
export async function requestSuggestion(itemId: string, photo: Blob): Promise<SuggestResult> {
  const failed = (problem: SuggestProblem): SuggestResult => ({ ok: false, problem, requestId: null, retryAt: null, remaining: null });
  try {
    const { data } = await supabaseBrowser().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return failed("not_a_vendor");

    const form = new FormData();
    form.set("itemId", itemId);
    form.set("photo", photo, "dish.jpg");
    const response = await fetch("/api/menu/suggest", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (response.ok && body?.suggestion) {
      return {
        ok: true,
        suggestion: body.suggestion as Suggestion,
        model: String(body.model ?? ""),
        remaining: typeof body.remaining === "number" ? body.remaining : null,
      };
    }
    return {
      ok: false,
      // An answer we do not recognise (a crash page, a proxy error) is the general failure.
      problem: typeof body?.problem === "string" ? (body.problem as SuggestProblem) : "ai_failed",
      requestId: typeof body?.requestId === "string" ? body.requestId : null,
      retryAt: typeof body?.retryAt === "string" ? body.retryAt : null,
      remaining: typeof body?.remaining === "number" ? body.remaining : null,
    };
  } catch {
    return failed("ai_failed"); // the request never reached our server
  }
}
