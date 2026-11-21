// Explore's search: which trucks match what the customer typed. Pure logic,
// no browser and no network, so it can be unit tested
// (tests/unit/truck-search.test.ts).

/** A dish as the search needs it: its ID, its truck and its saved name. */
export type DishName = { id: string; truck_id: string; name: string };

/**
 * Text as the search compares it: lower case, with accents and Arabic
 * vowel marks removed and the alef and ya variants made alike, so "كرك"
 * finds "كَرَك" and "cafe" finds "Café".
 */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٕـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The trucks that match `query`, in their original order.
 *
 * A truck matches when the query is found in its saved name, cuisine or
 * description, in the words shown for it in the current language
 * (`shownFor`), or in the name of one of its dishes (saved, or as shown:
 * `dishShown`). With an empty query every truck matches.
 *
 * `dishes` on a result lists the dishes that matched, and only when the
 * truck's own words did not: that is what the row shows as the reason.
 */
export function matchTrucks<T extends { id: string; name: string; cuisine: string; blurb: string }>(
  trucks: T[],
  dishes: DishName[],
  query: string,
  shownFor: (truck: T) => string[] = () => [],
  dishShown: (dish: DishName) => string = (dish) => dish.name,
): { truck: T; dishes: DishName[] }[] {
  const wanted = fold(query);
  if (wanted === "") return trucks.map((truck) => ({ truck, dishes: [] }));

  const results: { truck: T; dishes: DishName[] }[] = [];
  for (const truck of trucks) {
    const own = [truck.name, truck.cuisine, truck.blurb, ...shownFor(truck)].some((words) => fold(words).includes(wanted));
    const found = dishes.filter(
      (dish) => dish.truck_id === truck.id && (fold(dish.name).includes(wanted) || fold(dishShown(dish)).includes(wanted)),
    );
    if (own) results.push({ truck, dishes: [] });
    else if (found.length > 0) results.push({ truck, dishes: found });
  }
  return results;
}
