/**
 * Line art for Qafla's black banners: the Kuwait Towers on a low rise with
 * a food truck parked in front. Drawn in the colour of the text around it
 * (`currentColor`), thin and quiet, so it decorates a banner without
 * competing with its title. Decoration only: it is hidden from assistive
 * technology. The scene is never mirrored; in Arabic it simply sits at the
 * other end of the banner.
 */
export function ParkLineArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 130"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {/* The rise the towers stand on, and the ground line. */}
      <path d="M2 116c40-12 78-18 118-18 22 0 40 3 58 8" />
      <path d="M96 124h160" />
      {/* The shorter tower: a needle with one sphere. */}
      <path d="M78 100l7-66 7 66" />
      <circle cx="85" cy="52" r="9" />
      {/* The taller tower: a needle with a larger sphere and a small one above it. */}
      <path d="M108 99l8-91 8 91" />
      <circle cx="116" cy="48" r="12" />
      <circle cx="116" cy="26" r="5" />
      {/* The truck: cab, body with a serving hatch and a striped awning, two wheels. */}
      <path d="M150 112h-8V88l10-14h18v38" />
      <path d="M148 88h18" />
      <path d="M170 112V62h78v50h-10" />
      <path d="M182 74h54v20h-54z" />
      <path d="M178 74l4-10h54l4 10" />
      <path d="M192 64l-2 10M204 64l-1 10M216 64v10M228 64l1 10" />
      <path d="M166 112h44" />
      <circle cx="158" cy="114" r="8" />
      <circle cx="224" cy="114" r="8" />
    </svg>
  );
}
