import { REPLAY, type Evening } from "./rush.ts";
export type RushData = { serviceDate: string; now: number; history: Evening[] };
export const serviceDay = (date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse("1970-01-04T00:00:00Z")) / 86400000);
export function replayDate(data: RushData) {
  return [...new Set(data.history.map(r => r.serviceDate!))].filter(d => d < data.serviceDate).sort().at(-1) ?? null;
}
export function validSelection(data: RushData, date: unknown, now: unknown) {
  return typeof now === "number" && Number.isFinite(now) && (
    (date === data.serviceDate && now >= 0 && now <= data.now) ||
    (date === replayDate(data) && REPLAY.some(time=>time===now))
  );
}
