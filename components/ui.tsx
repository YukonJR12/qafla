import { formatKwd } from "@/lib/money";
import type { Locale } from "@/lib/i18n";

// Small pieces shared by every customer screen. None of them hold state,
// so they work in server and client components alike.

/**
 * A price. `bdi` keeps "3.200 د.ك." in one piece inside right-to-left text,
 * and tabular numerals keep columns of prices aligned.
 */
export function Money({ amount, locale, className = "" }: { amount: number | string; locale: Locale; className?: string }) {
  return <bdi className={`tabular-nums whitespace-nowrap ${className}`}>{formatKwd(amount, locale)}</bdi>;
}

/** Text whose direction must not be disturbed by its surroundings (times, order references). */
export function Isolate({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <bdi className={`tabular-nums whitespace-nowrap ${className}`}>{children}</bdi>;
}

type IconProps = { className?: string };
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Points "forward" in the reading direction; flips in Arabic. */
export function ArrowForward({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 rtl:-scale-x-100 ${className}`}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Points "back" in the reading direction; flips in Arabic. */
export function ArrowBack({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 rtl:-scale-x-100 ${className}`}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function CheckIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function GlobeIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
    </svg>
  );
}

export function BagIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <path d="M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 016 0v2" />
    </svg>
  );
}

export function ClockOffIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2M4 4l16 16" />
    </svg>
  );
}

export function StoreIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" />
    </svg>
  );
}

/** A closed padlock: booking for this time has closed. */
export function LockIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** A five-pointed star, filled or outlined. */
export function StarIcon({ className = "", filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} className={className}>
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" />
    </svg>
  );
}

export function MinusIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <path d="M6 12h12" />
    </svg>
  );
}

export function PlusIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

/**
 * The Yellow Punk pickup-time sticker: a pill with an ink edge and a crisp
 * 3 px offset shadow (DESIGN.md, Elevation & Depth).
 */
export function PickupSticker({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-ink bg-yellow-punk px-3 py-1 text-sm font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] ${className}`}
    >
      <span aria-hidden className="size-2 rounded-full bg-ink" />
      {children}
    </span>
  );
}

/** A quiet ink label for states that are not a pickup time (closed, no slots). */
export function StateLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-control bg-ink px-2.5 py-1 text-sm font-semibold text-snowy-white ${className}`}>
      {children}
    </span>
  );
}

// The ink primary button (48 px tall or more).
const primaryBase =
  "inline-flex min-h-12 w-full items-center gap-2 rounded-control bg-ink px-4 py-3 text-base font-bold text-snowy-white transition-colors duration-[120ms] ease-out hover:bg-ink-pressed active:bg-ink-pressed disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted";
export const primaryButton = `${primaryBase} justify-center`;
/** The same button with its label at the start and an amount at the end. */
export const primaryButtonSplit = `${primaryBase} justify-between`;

/** Classes for a secondary, outlined button. */
export const secondaryButton =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control border border-outline bg-snowy-white px-4 py-3 text-base font-bold text-ink transition-colors duration-[120ms] ease-out hover:border-ink hover:bg-subtle";
