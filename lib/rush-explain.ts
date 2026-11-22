import { explanation, forecast } from "./rush.ts";
import { validSelection, type RushData } from "./rush-data.ts";
export function rushHandler(
  authorize: (token: string) => Promise<boolean>,
  ask: (
    figures: Record<string, unknown>,
    locale: "en" | "ar",
  ) => Promise<string | null>,
  load: (token: string) => Promise<RushData>,
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
    let data: RushData;
    try { data = await load(token); }
    catch { return Response.json({error: "history_unavailable"}, {status: 503}); }
    const history = data.history;
    const row = history.find(
      (r) =>
        r.serviceDate === body.date && r.truck === body.truck && r.slot === body.slot,
    );
    if (
      !row ||
      !validSelection(data, body.date, body.now) ||
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
      minutesUntilClose: Math.max(0,Math.ceil(f.cutoff - f.now)),
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
