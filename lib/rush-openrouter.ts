// Server-only transport, imported only by the API route. Never import from a client component.
const cache = new Map<string, string>();
export async function askRushExplanation(
  figures: Record<string, unknown>,
  locale: "en" | "ar",
): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY,
    model = process.env.OPENROUTER_MODEL;
  if (!key || !model) return null;
  const cacheKey = JSON.stringify([locale, figures]);
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  const response = await fetch(
    `${(process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "Qafla Rush Forecast",
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1000,
        reasoning: { effort: "low" },
        messages: [
          {
            role: "system",
            content: `Explain the strongest signal in this simulated booking forecast in one short sentence in ${locale === "ar" ? "Arabic" : "English"}. Use only supplied aggregate figures. Do not invent causes, guarantees, demand beyond capacity, kitchen prep times, or actions already taken. Mention simulated history. If booking is closed or full do not predict new bookings. Advisory only. No markdown.`,
          },
          { role: "user", content: JSON.stringify(figures) },
        ],
      }),
    },
  );
  if (!response.ok) return null;
  const json = await response.json();
  if (json?.choices?.[0]?.finish_reason === "length") return null;
  const text = json?.choices?.[0]?.message?.content;
  if (
    typeof text !== "string" ||
    text.length < 10 ||
    text.length > 650 ||
    /https?:|sk-or-|<|>/.test(text)
  )
    return null;
  const normalized = text.replace(/[٠-٩]/g, (c) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(c)),
  );
  const allowed = new Set(
    Object.values(figures)
      .filter((v) => typeof v === "number")
      .map(String),
  );
  if (
    (normalized.match(/\d+(?:\.\d+)?/g) || []).some(
      (n) => !allowed.has(String(Number(n))),
    )
  )
    return null;
  if (cache.size >= 128) cache.clear();
  cache.set(cacheKey, text);
  return text;
}
