import {
  DEMO_DAY,
  REPLAY,
  explanation,
  forecast,
  generateHistory,
} from "./rush.ts";
export function rushHandler(
  authorize: (token: string) => Promise<boolean>,
  ask: (
    figures: Record<string, unknown>,
    locale: "en" | "ar",
  ) => Promise<string | null>,
) {
  return async (request: Request): Promise<Response> => {
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer (.+)$/i)?.[1];
    if (!token)
      return Response.json({ error: "unauthorized" }, { status: 401 });
    try {
      if (!(await authorize(token)))
        return Response.json({ error: "manager_only" }, { status: 403 });
    } catch {
      return Response.json(
        { error: "authorization_unavailable" },
        { status: 503 },
      );
    }
    let body;
    try {
      const text = await request.text();
      if (text.length > 1024) throw Error();
      body = JSON.parse(text);
      if (!body || typeof body !== "object") throw Error();
    } catch {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }
    const history = generateHistory();
    const row = history.find(
      (r) =>
        r.day === DEMO_DAY && r.truck === body.truck && r.slot === body.slot,
    );
    if (
      !row ||
      !REPLAY.includes(body.now) ||
      !["en", "ar"].includes(body.locale)
    )
      return Response.json({ error: "invalid_selection" }, { status: 400 });
    const f = forecast(history, row, body.now);
    // Only server-recomputed aggregates reach the model, never user input or booking records.
    const figures = {
      current: f.current,
      capacity: f.capacity,
      additional: Number(f.additional.toFixed(1)),
      projected: Number(f.projected.toFixed(1)),
      low: f.low,
      high: f.high,
      historySize: f.n,
      similarEveningAdditional: Number(f.mean.toFixed(1)),
      state: f.state,
      minutesUntilClose: f.cutoff - f.now,
    };
    let text: string | null = null;
    try {
      text = await ask(figures, body.locale);
    } catch {
      /* The forecast remains usable. */
    }
    return Response.json(
      {
        explanation: text || explanation(f, body.locale),
        source: text ? "openrouter" : "fallback",
        figures,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  };
}
