// Physical positions never depend on language, availability, or database sort order.
export const PARK_TRUCKS = [
  { id: "T01", color: "#d89a46", x: -3.6, z: 6, roof: "tea" },
  { id: "T02", color: "#f42902", x: 3.6, z: 6, roof: "burger" },
  { id: "T03", color: "#219c86", x: -3.6, z: 0, roof: "taco" },
  { id: "T04", color: "#3877bf", x: 3.6, z: 0, roof: "bowl" },
  { id: "T05", color: "#927342", x: -3.6, z: -6, roof: "chimney" },
  { id: "T06", color: "#c66d91", x: 3.6, z: -6, roof: "sweets" },
] as const;

export function parkTruck(id: string | null) { return PARK_TRUCKS.find((truck) => truck.id === id); }

export const parkWords = {
  en: { title: "The park", map: "Map", list: "Truck list", reset: "Reset view", hint: "Drag to look around · Pinch to zoom", tap: "Tap a truck to find your next bite.", loading: "Opening the park…", fallback: "The 3D view is unavailable. Choose a truck from the list.", error: "Couldn’t refresh availability. Try again.", retry: "Try again", menu: "View menu", close: "Close truck details", find: "Find my truck", entrance: "Entrance", details: "Truck details" },
  ar: { title: "ساحة قافلة", map: "الخريطة", list: "قائمة العربات", reset: "إعادة المنظور", hint: "اسحب للدوران · قرّب بإصبعين", tap: "اضغط على عربة وشوف شنو تشتهي.", loading: "جارٍ فتح الساحة…", fallback: "العرض ثلاثي الأبعاد مو متاح. اختر عربة من القائمة.", error: "تعذّر تحديث التوفر. حاول مرة ثانية.", retry: "حاول مرة ثانية", menu: "شوف القائمة", close: "إغلاق تفاصيل العربة", find: "وين عربتي؟", entrance: "المدخل", details: "تفاصيل العربة" },
};
