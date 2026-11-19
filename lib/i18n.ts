// Every word the customer screens show, in English and Arabic.
// Voice (DESIGN.md): like someone handing an order across a counter.

export type Locale = "en" | "ar";
export const LOCALE_COOKIE = "qafla_locale";

const en = {
  appName: "Qafla Pickup",
  homeLabel: "Qafla Pickup home",
  otherLanguage: "العربية",
  otherLanguageLabel: "Switch to Arabic",
  loading: "Loading…",
  back: "Back",

  // Welcome
  welcomeLine: "Order ahead from the trucks. Collect it hot.",
  exploreTrucks: "Explore trucks",
  parkHours: "Pickup 5:00–11:00 PM · Kuwait time",

  // Explore
  chooseTruck: "Choose a truck",
  openCount: (n: number) => `${n} open`,
  nextPickup: (time: string) => `Next pickup · ${time}`,
  noSlotsToday: "No pickup times left today",
  closedTonight: "Closed for tonight",
  closedGroup: "Closed tonight",
  seeMenu: "See menu",
  orderFromLabel: (truck: string, state: string) => `${truck}. ${state}`,

  // Menu
  backToTrucks: "Back to trucks",
  menu: "Menu",
  oneTruck: "One truck per order",
  add: "Add",
  addItem: (item: string) => `Add ${item}`,
  increase: (item: string) => `One more ${item}`,
  decrease: (item: string) => `One fewer ${item}`,
  remove: (item: string) => `Remove ${item}`,
  quantityOf: (item: string, n: number) => `${n} ${item} in cart`,
  soldOut: "Sold out",
  viewCart: "View cart",
  savedCart: (truck: string, n: number, total: string) =>
    `Your ${truck} cart is saved: ${n === 1 ? "1 item" : `${n} items`}, ${total}`,
  view: "View",
  closedMenuNote: "Closed for tonight. You can still read the menu.",

  // Replace-cart confirmation
  replaceTitle: "Start a new cart?",
  replaceBody: (n: number, truck: string, total: string) =>
    `Adding this will replace your ${n === 1 ? "1 item" : `${n} items`} from ${truck} (${total}).`,
  replaceNewItem: "New item",
  replaceNewTruck: "New truck",
  replaceConfirm: "Replace cart and add item",
  replaceKeep: "Keep my cart",

  // Cart
  cart: "Cart",
  cartEmptyTitle: "Your cart is empty",
  cartEmptyBody: "Pick a truck and add a dish to start an order.",
  orderingFrom: "Ordering from",
  total: "Total",
  itemCount: (n: number) => (n === 1 ? "1 item" : `${n} items`),
  choosePickup: "Choose pickup time",
  addMore: "Add more dishes",

  // Checkout
  checkout: "Checkout",
  pickupTime: "Pickup time",
  notChosen: "Not chosen yet",
  slotsNote: "15-minute slots · Kuwait time",
  full: "Full",
  justFilled: "Just filled",
  selected: "Selected",
  earliest: "Earliest available",
  nextAvailable: "Next available",
  placesLeft: (n: number) => (n === 1 ? "1 place left" : `${n} places left`),
  payment: "Payment",
  payAtPickup: "Pay at pickup",
  payAtPickupHint: (truck: string) => `Cash or card at the ${truck} counter`,
  placeOrder: "Place order",
  placing: "Placing order…",
  signInToOrder: "Sign in to place order",
  chooseTimeFirst: "Choose a pickup time to continue",
  slotFilledTitle: (time: string) => `The ${time} slot just filled. Your cart is saved.`,
  slotFilledBody: (truck: string) =>
    `Another customer took the last ${truck} place at that time. Your items and total are unchanged.`,
  useTime: (time: string) => `Use ${time}`,
  reviewTime: (time: string) => `New pickup time: ${time}. Check it, then place your order.`,
  truckClosedTitle: (truck: string) => `${truck} has closed for tonight. Your order wasn’t placed.`,
  truckClosedBody: "No order was created. Your cart stays saved while you look at other trucks.",
  browseOpen: "Browse open trucks",
  cannotPlace: "Can’t place order",
  tooSoon: "That time is now too close. Choose a later pickup time.",
  itemUnavailable: "A dish in your cart is no longer available. Go back to the menu and update your cart.",
  notCustomer: "This account can’t place customer orders. Sign in with a customer account.",
  genericError: "We couldn’t place your order. Check your connection and try again.",
  signedInAs: (email: string) => `Signed in as ${email}`,
  signOut: "Sign out",

  // Cart and checkout states
  retry: "Try again",
  cartLoadErrorTitle: "We couldn’t load your cart",
  cartLoadErrorBody: "Your cart is still saved on this phone. Check your connection and try again.",
  timesLoadErrorTitle: "We couldn’t load pickup times",
  timesLoadErrorBody: "Your cart is saved. Check your connection and try again.",
  missingItems: (n: number) =>
    n === 1
      ? "1 dish in your cart is no longer on this truck’s menu."
      : `${n} dishes in your cart are no longer on this truck’s menu.`,
  removeMissing: (n: number): string => (n === 1 ? "Remove it from my cart" : "Remove them from my cart"),
  soldOutItem: (item: string) => `${item} has sold out.`,
  removeItem: (item: string) => `Remove ${item}`,
  fixCartFirst: "Update your cart to continue",
  cartNeedsReview: "Your cart needs a change before you can order.",
  reviewCart: "Review cart",
  slotPassedTitle: (time: string) => `${time} is now too close to order for. Your cart is saved.`,
  slotGoneBody: "Choose a new pickup time below.",

  // An order was sent but its answer never arrived
  checkOrderTitle: "We couldn’t confirm your order",
  checkOrderBody: (truck: string, time: string) =>
    `Your order to ${truck} for ${time} was sent, but the answer didn’t reach this phone. Check it before you order again.`,
  checkMyOrder: "Check my order",
  checkingOrder: "Checking your order…",
  checkFailed: "Still no answer. Check your connection and try again.",
  notPlaced: "Your earlier order didn’t go through, so nothing was placed. Your cart is saved.",

  // Sign in
  signInTitle: "Sign in to place your order",
  signUpTitle: "Create your account",
  cartKept: "Your cart and pickup time are saved.",
  email: "Email",
  password: "Password",
  passwordHint: "At least 8 characters",
  name: "Name (optional)",
  signIn: "Sign in",
  createAccount: "Create account",
  working: "One moment…",
  toSignUp: "New here? Create an account",
  toSignIn: "Have an account? Sign in",
  invalidLogin: "That email and password don’t match. Check them and try again.",
  emailTaken: "This email already has an account. Sign in instead.",
  weakPassword: "Use a password with at least 8 characters.",
  confirmEmail: "Check your email to confirm your account, then sign in.",
  authError: "We couldn’t sign you in. Check your connection and try again.",

  // Ticket
  orderPlaced: "Order placed",
  pickUpAt: "Pick up at",
  orderRef: "Order reference",
  status: "Status",
  paymentLine: "Pay at pickup · not paid yet",
  totalAtCounter: "Total to pay at the counter",
  statusName: {
    placed: "Placed",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready for pickup",
    collected: "Collected",
    rejected: "Rejected",
    cancelled: "Cancelled",
  } as Record<string, string>,
  statusHelp: {
    placed: "Waiting for the truck to accept your order.",
    accepted: "The truck has your order.",
    preparing: "Your food is being cooked.",
    ready: "Your order is ready for pickup",
    collected: "Collected. Enjoy your meal.",
    rejected: "The truck couldn’t take this order.",
    cancelled: "This order was cancelled.",
  } as Record<string, string>,
  checkStatus: "Check status",
  backToTrucksFromTicket: "Back to trucks",
  orderNotFound: "We couldn’t find this order",
  orderNotFoundBody: "Sign in with the account that placed it.",
};

type Dict = typeof en;

const ar: Dict = {
  appName: "قافلة",
  homeLabel: "الصفحة الرئيسية لقافلة",
  otherLanguage: "English",
  otherLanguageLabel: "التبديل إلى الإنجليزية",
  loading: "جارٍ التحميل…",
  back: "رجوع",

  welcomeLine: "اطلب من العربات قبل ما توصل، واستلم طلبك حار.",
  exploreTrucks: "تصفح العربات",
  parkHours: "الاستلام من 5:00 إلى 11:00 م · بتوقيت الكويت",

  chooseTruck: "اختر عربة",
  openCount: (n) => `${n} مفتوحة`,
  nextPickup: (time) => `أقرب استلام · ${time}`,
  noSlotsToday: "ما في أوقات استلام متاحة اليوم",
  closedTonight: "مغلقة الليلة",
  closedGroup: "مغلقة الليلة",
  seeMenu: "القائمة",
  orderFromLabel: (truck, state) => `${truck}. ${state}`,

  backToTrucks: "رجوع إلى العربات",
  menu: "القائمة",
  oneTruck: "عربة واحدة لكل طلب",
  add: "أضف",
  addItem: (item) => `أضف ${item}`,
  increase: (item) => `زِد ${item}`,
  decrease: (item) => `نقّص ${item}`,
  remove: (item) => `احذف ${item}`,
  quantityOf: (item, n) => `${n} ${item} في السلة`,
  soldOut: "خلصت الكمية",
  viewCart: "عرض السلة",
  savedCart: (truck, n, total) => `سلتك من ${truck} محفوظة: ${arItems(n)}، ${total}`,
  view: "عرض",
  closedMenuNote: "مغلقة الليلة. تقدر تتصفح القائمة.",

  replaceTitle: "تبدأ سلة جديدة؟",
  replaceBody: (n, truck, total) => `إضافة هذا الصنف تستبدل ${arItems(n)} من ${truck} (${total}).`,
  replaceNewItem: "الصنف الجديد",
  replaceNewTruck: "العربة الجديدة",
  replaceConfirm: "استبدل السلة وأضف الصنف",
  replaceKeep: "خلّ سلتي",

  cart: "السلة",
  cartEmptyTitle: "سلتك فاضية",
  cartEmptyBody: "اختر عربة وأضف صنف عشان تبدأ طلبك.",
  orderingFrom: "الطلب من",
  total: "المجموع",
  itemCount: (n) => arItems(n),
  choosePickup: "اختر وقت الاستلام",
  addMore: "أضف أصناف ثانية",

  checkout: "إتمام الطلب",
  pickupTime: "وقت الاستلام",
  notChosen: "ما تم الاختيار",
  slotsNote: "كل 15 دقيقة · بتوقيت الكويت",
  full: "مكتمل",
  justFilled: "اكتمل للتو",
  selected: "محدد",
  earliest: "أقرب وقت متاح",
  nextAvailable: "الوقت التالي المتاح",
  placesLeft: (n) => (n === 1 ? "باقي مكان واحد" : n === 2 ? "باقي مكانين" : `باقي ${n} أماكن`),
  payment: "الدفع",
  payAtPickup: "الدفع عند الاستلام",
  payAtPickupHint: (truck) => `نقداً أو بالبطاقة عند كاونتر ${truck}`,
  placeOrder: "تأكيد الطلب",
  placing: "جارٍ تأكيد الطلب…",
  signInToOrder: "سجّل الدخول لتأكيد الطلب",
  chooseTimeFirst: "اختر وقت الاستلام للمتابعة",
  slotFilledTitle: (time) => `اكتمل الحجز لوقت ${time}. سلتك محفوظة.`,
  slotFilledBody: (truck) => `عميل ثاني حجز آخر مكان عند ${truck} في هذا الوقت. أصنافك ومجموعك مثل ما هي.`,
  useTime: (time) => `اختر ${time}`,
  reviewTime: (time) => `وقت الاستلام الجديد: ${time}. راجعه ثم أكّد الطلب.`,
  truckClosedTitle: (truck) => `${truck} أغلقت الليلة. طلبك ما تم.`,
  truckClosedBody: "ما تم إنشاء أي طلب. سلتك محفوظة وأنت تتصفح العربات الثانية.",
  browseOpen: "تصفح العربات المفتوحة",
  cannotPlace: "ما يمكن تأكيد الطلب",
  tooSoon: "هذا الوقت صار قريب جداً. اختر وقت استلام أبعد.",
  itemUnavailable: "صنف في سلتك ما عاد متوفر. ارجع للقائمة وعدّل سلتك.",
  notCustomer: "هذا الحساب ما يقدر يطلب كعميل. سجّل الدخول بحساب عميل.",
  genericError: "ما قدرنا نأكد طلبك. تأكد من الاتصال وحاول مرة ثانية.",
  signedInAs: (email) => `مسجّل الدخول باسم ${email}`,
  signOut: "تسجيل الخروج",

  retry: "حاول مرة ثانية",
  cartLoadErrorTitle: "ما قدرنا نحمّل سلتك",
  cartLoadErrorBody: "سلتك محفوظة على جهازك. تأكد من الاتصال وحاول مرة ثانية.",
  timesLoadErrorTitle: "ما قدرنا نحمّل أوقات الاستلام",
  timesLoadErrorBody: "سلتك محفوظة. تأكد من الاتصال وحاول مرة ثانية.",
  missingItems: (n) =>
    n === 1
      ? "صنف واحد في سلتك ما عاد موجود في قائمة هذه العربة."
      : n === 2
        ? "صنفين في سلتك ما عادوا موجودين في قائمة هذه العربة."
        : `${n} أصناف في سلتك ما عادت موجودة في قائمة هذه العربة.`,
  removeMissing: (n) => (n === 1 ? "احذفه من سلتي" : "احذفها من سلتي"),
  soldOutItem: (item) => `${item} خلصت كميته.`,
  removeItem: (item) => `احذف ${item}`,
  fixCartFirst: "عدّل سلتك للمتابعة",
  cartNeedsReview: "سلتك تحتاج تعديل قبل ما تطلب.",
  reviewCart: "راجع السلة",
  slotPassedTitle: (time) => `وقت ${time} صار قريب جداً للطلب. سلتك محفوظة.`,
  slotGoneBody: "اختر وقت استلام جديد من الأوقات تحت.",

  checkOrderTitle: "ما قدرنا نتأكد من طلبك",
  checkOrderBody: (truck, time) =>
    `أرسلنا طلبك إلى ${truck} لوقت ${time}، لكن الرد ما وصل لجهازك. تحقق منه قبل ما تطلب مرة ثانية.`,
  checkMyOrder: "التحقق من طلبي",
  checkingOrder: "جارٍ التحقق من طلبك…",
  checkFailed: "ما وصل رد للحين. تأكد من الاتصال وحاول مرة ثانية.",
  notPlaced: "طلبك السابق ما تم، وما انحجز أي شي. سلتك محفوظة.",

  signInTitle: "سجّل الدخول لتأكيد طلبك",
  signUpTitle: "أنشئ حسابك",
  cartKept: "سلتك ووقت الاستلام محفوظين.",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  passwordHint: "8 أحرف على الأقل",
  name: "الاسم (اختياري)",
  signIn: "تسجيل الدخول",
  createAccount: "إنشاء حساب",
  working: "لحظة…",
  toSignUp: "جديد؟ أنشئ حساب",
  toSignIn: "عندك حساب؟ سجّل الدخول",
  invalidLogin: "البريد أو كلمة المرور غير صحيحة. تأكد وحاول مرة ثانية.",
  emailTaken: "هذا البريد له حساب. سجّل الدخول.",
  weakPassword: "استخدم كلمة مرور من 8 أحرف على الأقل.",
  confirmEmail: "افتح بريدك لتأكيد الحساب، ثم سجّل الدخول.",
  authError: "ما قدرنا نسجّل دخولك. تأكد من الاتصال وحاول مرة ثانية.",

  orderPlaced: "تم تأكيد الطلب",
  pickUpAt: "الاستلام الساعة",
  orderRef: "رقم الطلب",
  status: "الحالة",
  paymentLine: "الدفع عند الاستلام · غير مدفوع",
  totalAtCounter: "المبلغ عند الكاونتر",
  statusName: {
    placed: "تم الطلب",
    accepted: "مقبول",
    preparing: "قيد التحضير",
    ready: "جاهز للاستلام",
    collected: "تم الاستلام",
    rejected: "مرفوض",
    cancelled: "ملغي",
  },
  statusHelp: {
    placed: "بانتظار قبول العربة لطلبك.",
    accepted: "العربة استلمت طلبك.",
    preparing: "طلبك قيد التحضير.",
    ready: "طلبك جاهز للاستلام",
    collected: "تم الاستلام. بالعافية.",
    rejected: "العربة ما قدرت تستلم هذا الطلب.",
    cancelled: "تم إلغاء هذا الطلب.",
  },
  checkStatus: "تحديث الحالة",
  backToTrucksFromTicket: "رجوع إلى العربات",
  orderNotFound: "ما لقينا هذا الطلب",
  orderNotFoundBody: "سجّل الدخول بالحساب اللي أكّد الطلب.",
};

function arItems(n: number): string {
  if (n === 1) return "صنف واحد";
  if (n === 2) return "صنفين";
  return n <= 10 ? `${n} أصناف` : `${n} صنف`;
}

export const dictionary: Record<Locale, Dict> = { en, ar };

// ---------------------------------------------------------------------------
// Arabic display labels for the seed data. The database keeps the canonical
// English names, IDs and prices from seed/*.csv; these are shown on top.
// ---------------------------------------------------------------------------

const arTrucks: Record<string, { name: string; cuisine: string; blurb: string }> = {
  T01: { name: "كرك كورنر", cuisine: "شاي وسناكات", blurb: "كرك وتوست ولقمات سريعة." },
  T02: { name: "ديون برجر", cuisine: "برجر", blurb: "سماش برجر يتحضّر عند الطلب." },
  T03: { name: "تاكو صحة", cuisine: "تاكو", blurb: "تاكو الشارع بلمسة خليجية." },
  T04: { name: "نودل واجن", cuisine: "نودلز", blurb: "نودلز الووك، من النار مباشرة." },
  T05: { name: "صاج ستيشن", cuisine: "لفائف صاج", blurb: "لفائف تنخبز على الصاج قدامك." },
  T06: { name: "لقيمات وشركاه", cuisine: "حلويات", blurb: "لقيمات وكنافة ومشروبات باردة." },
};

const arItemNames: Record<string, string> = {
  M101: "شاي كرك",
  M102: "كرك زعفران",
  M103: "توست جبن وزعتر",
  M104: "ساندويش چبس عمان",
  M105: "قطعة كيكة التمر",
  M201: "كلاسيك سماش",
  M202: "برجر دجاج حار",
  M203: "ترافل سماش",
  M204: "لودد فرايز",
  M205: "مشروم سويس",
  M301: "تاكو دجاج تكا",
  M302: "تاكو بيريا لحم (3)",
  M303: "تاكو حلوم",
  M304: "كوب إيلوتي",
  M305: "تاكو ربيان",
  M401: "باد تاي دجاج",
  M402: "أودون لحم",
  M403: "لو مين خضار",
  M404: "دمبلنغ بزيت الفلفل (6)",
  M405: "شاي مثلج بالمانجو",
  M501: "صاج شاورما دجاج",
  M502: "صاج حلوم وزعتر",
  M503: "صاج كفتة",
  M504: "صاج نوتيلا وموز",
  M505: "ليمون ونعناع طازج",
  M601: "لقيمات (12)",
  M602: "كوب كنافة",
  M603: "كيكة الحليب بالفستق",
  M604: "سلاش فيمتو",
  M605: "آيس كريم زعفران",
};

const arItemDescriptions: Record<string, string> = {
  M101: "شاي قوي بالهيل والحليب المبخّر.",
  M104: "خبز طري، جبن كريمي وچبس مطحون.",
  M201: "قطعتين لحم سماش، جبن وصوص البيت.",
  M204: "بطاط مع صوص الجبن وبصل مقرمش.",
  M302: "لحم مطبوخ على مهل في تورتيلا الذرة، مع مرق للتغميس.",
  M402: "نودلز أودون سميكة مع شرائح لحم وبصل أخضر.",
  M502: "حلوم مشوي، زعتر وطماطم في خبز صاج رقيق.",
  M601: "لقيمات مقرمشة مع دبس التمر والسمسم.",
};

export function truckName(truck: { id: string; name: string }, locale: Locale): string {
  return locale === "ar" ? (arTrucks[truck.id]?.name ?? truck.name) : truck.name;
}

export function truckCuisine(truck: { id: string; cuisine: string }, locale: Locale): string {
  return locale === "ar" ? (arTrucks[truck.id]?.cuisine ?? truck.cuisine) : truck.cuisine;
}

export function truckBlurb(truck: { id: string; blurb: string }, locale: Locale): string {
  return locale === "ar" ? (arTrucks[truck.id]?.blurb ?? truck.blurb) : truck.blurb;
}

export function itemName(item: { id: string; name: string }, locale: Locale): string {
  return locale === "ar" ? (arItemNames[item.id] ?? item.name) : item.name;
}

export function itemDescription(
  item: { id: string; description: string | null },
  locale: Locale,
): string | null {
  return locale === "ar" ? (arItemDescriptions[item.id] ?? null) : item.description;
}
