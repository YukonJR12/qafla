// Only checkout can mark an entrance. A URL parameter must never replay it.
const pending = new Map<string, string>();
const key = (customer: string) => `qafla.new-ticket.${customer}`;
export function markNewTicket(customer: string, order: string) {
  pending.set(customer, order);
  // Survive the gateway round-trip in this tab, without sharing the marker across accounts.
  try { sessionStorage.setItem(key(customer), order); } catch { /* unavailable storage: SPA handoff still works */ }
}
export function consumeNewTicket(customer: string, order: string) {
  let saved = pending.get(customer);
  try { saved ??= sessionStorage.getItem(key(customer)) ?? undefined; } catch { /* optional tab storage */ }
  if (saved !== order) return false;
  pending.delete(customer);
  try { sessionStorage.removeItem(key(customer)); } catch { /* optional tab storage */ }
  return true;
}
