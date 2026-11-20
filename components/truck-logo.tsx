import Image from "next/image";
import { truckLogo, truckPhoto } from "@/lib/images";

/**
 * A truck's own logo on a white tile, so it stays legible on Red Orange
 * and on photographs. A truck with no logo yet shows its food photo, or
 * failing that its initials in poster lettering. Decorative: the truck's name is always printed next
 * to it, so the image has an empty alt and is announced once.
 */
export function TruckLogo({
  truck,
  className = "size-14",
  sizes = "56px",
  preload = false,
}: {
  /** The canonical (English) name, used only for the initials. */
  truck: { id: string; name: string };
  className?: string;
  sizes?: string;
  preload?: boolean;
}) {
  const src = truckLogo(truck.id);
  const photo = truckPhoto(truck.id);
  if (!src && photo) {
    return (
      <span className={`inline-block shrink-0 overflow-hidden rounded-control border border-divider bg-white ${className}`}>
        <Image src={photo} alt="" width={640} height={640} sizes={sizes} preload={preload} className="size-full object-cover" />
      </span>
    );
  }
  if (!src) {
    const initials = truck.name
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return (
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-control border border-ink bg-red-orange font-display text-ink ${className}`}
      >
        {initials}
      </span>
    );
  }
  return (
    <span className={`inline-block shrink-0 overflow-hidden rounded-control border border-divider bg-white ${className}`}>
      <Image src={src} alt="" width={384} height={384} sizes={sizes} preload={preload} className="size-full object-contain p-1" />
    </span>
  );
}
