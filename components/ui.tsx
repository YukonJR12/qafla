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

/** A ticket stub: the customer's orders. */
export function TicketIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <path d="M4 7h16v3a2 2 0 000 4v3H4v-3a2 2 0 000-4V7zM14 7v10" />
    </svg>
  );
}

export function UserIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0115 0" />
    </svg>
  );
}

/** A flame: the kitchen board. */
export function FlameIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2 1-3.2 2-4 .2 1.6 1 2.4 2 2.6C10.5 9 11 6 12 3z" />
    </svg>
  );
}

/** A list: the vendor's menu. */
export function ListIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <path d="M9 7h11M9 12h11M9 17h11" />
      <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" />
    </svg>
  );
}

/** A bank card: pay online. */
export function CardIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10.5h18M7 15h3" />
    </svg>
  );
}

/** A camera: choose or take a photo. */
export function CameraIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/** Sliders: a setting, such as capacity. */
export function SlidersIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

/** A grid: the park overview. */
export function GridIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M4 15h16M10 4v16M15 4v16" />
    </svg>
  );
}

export function ClockIcon({ className = "" }: IconProps) {
  return (
    <svg {...base} className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
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
