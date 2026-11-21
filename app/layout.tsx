import type { Metadata, Viewport } from "next";
import { Alexandria, Archivo_Black, DM_Sans } from "next/font/google";
import { SessionGate } from "@/components/session-gate";
import { AccountProvider } from "@/lib/account";
import { CartProvider } from "@/lib/cart";
import { LocaleProvider } from "@/lib/locale";
import { getLocale } from "@/lib/locale-server";
import "./globals.css";

// Brand fonts from DESIGN.md. next/font downloads them at build time and
// serves them from our own domain, exposing each one as a CSS variable.
const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo-black",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

// Alexandria is a variable font, so every weight is available. The Latin
// subset is included so digits and "KWD" match the Arabic letters.
const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  variable: "--font-alexandria",
});

export const metadata: Metadata = {
  title: "Qafla Pickup · قافلة",
  description: "Order ahead from Qafla's food trucks and collect your food hot.",
};

// `cover` lets the launch screen paint under a phone's notch and home
// indicator. The colour of the browser's own bars is not set here: the launch
// screen and the session gate each render the <meta name="theme-color"> that
// fits what is on screen (Red Orange at launch, Snowy White after).
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The language comes from a cookie, so the whole document can be rendered
  // in the right language and direction on the server.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${archivoBlack.variable} ${dmSans.variable} ${alexandria.variable}`}
    >
      <body>
        <LocaleProvider locale={locale}>
          {/* Who is signed in, then that account's cart, then the gate that picks the screen. */}
          <AccountProvider>
            <CartProvider>
              <SessionGate>{children}</SessionGate>
            </CartProvider>
          </AccountProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
