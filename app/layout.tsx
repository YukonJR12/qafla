import type { Metadata } from "next";
import { Alexandria, Archivo_Black, DM_Sans } from "next/font/google";
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

const alexandria = Alexandria({
  weight: ["400", "900"],
  subsets: ["arabic"],
  variable: "--font-alexandria",
});

export const metadata: Metadata = {
  title: "Qafla Pickup · قافلة",
  description: "Order ahead from Qafla's food trucks and collect your food hot.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivoBlack.variable} ${dmSans.variable} ${alexandria.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
