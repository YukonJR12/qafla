/**
 * Up to two initials for the Account card, from the saved name ("Faisal
 * Alrefae" -> "FA") or, when no name was given, from the email address
 * ("qafla.customer@example.com" -> "QC"). Pure, so it is unit tested.
 */
export function initials(name: string | null | undefined, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const source = words.length > 0 ? words : email.split("@")[0].split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (source.length === 0) return "?";
  // Array.from keeps a letter with its accent or an Arabic letter in one piece.
  const first = (word: string) => Array.from(word)[0];
  const picked = source.length === 1 ? Array.from(source[0]).slice(0, 2) : [first(source[0]), first(source[source.length - 1])];
  return picked.join("").toLocaleUpperCase();
}
