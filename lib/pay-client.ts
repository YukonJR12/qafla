"use client";

import type { PaymentOutcome } from "./payments";
import { supabaseBrowser } from "./supabase";

// The browser's side of online payment. It only ever talks to this app's
// own server routes. It never holds the gateway token, never sends an
// amount, and never decides that something is paid.

async function post(path: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const { data } = await supabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, json: null };
  const response = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json().catch(() => null)) as Record<string, unknown> | null };
}

/**
 * Asks our server for the payment page for an order. Resolves to the page's
 * address, or to why there is none. Never throws.
 */
export async function startPayment(orderId: string, language: string): Promise<{ url: string } | { outcome: PaymentOutcome; reference: string | null }> {
  try {
    const { json } = await post("/api/payments/start", { orderId, language });
    if (typeof json?.paymentUrl === "string" && /^https:\/\//.test(json.paymentUrl)) return { url: json.paymentUrl };
    const problem = json?.problem;
    const reference = typeof json?.requestId === "string" ? json.requestId : null;
    if (problem === "already_paid") return { outcome: "paid", reference };
    if (problem === "not_found") return { outcome: "not_found", reference };
    return { outcome: "unavailable", reference };
  } catch {
    return { outcome: "unavailable", reference: null };
  }
}

/**
 * Asks our server what happened to an order's payment. Safe to call again
 * and again. `paymentId` is whatever the gateway put on the return address;
 * the server checks it with the gateway and believes nothing else.
 */
export async function verifyPayment(orderId: string, paymentId: string | null): Promise<{ outcome: PaymentOutcome; reference: string | null }> {
  try {
    const { json } = await post("/api/payments/verify", { orderId, paymentId });
    const outcome = typeof json?.outcome === "string" ? (json.outcome as PaymentOutcome) : "unavailable";
    return { outcome, reference: typeof json?.requestId === "string" ? json.requestId : null };
  } catch {
    return { outcome: "unavailable", reference: null };
  }
}
