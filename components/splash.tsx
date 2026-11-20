import Image from "next/image";

/**
 * The launch screen: the official Qafla logo on Snowy White (DESIGN.md,
 * Logo). It is shown while the browser restores a saved session, and for
 * the moment it takes to send someone to sign-in or to their workspace.
 *
 * `label` is read out by a screen reader; nothing else is on the screen.
 */
export function Splash({ label, arabicName = true }: { label: string; arabicName?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-snowy-white px-4 text-center">
      <div className="logo-enter flex flex-col items-center gap-3">
        <Image
          src="/brand/qafla-logo.png"
          alt=""
          width={1254}
          height={1254}
          sizes="(min-width: 640px) 288px, 224px"
          className="h-auto w-56 max-w-full sm:w-72"
          preload
        />
        {arabicName && (
          <p lang="ar" dir="rtl" aria-hidden className="font-arabic text-4xl leading-[1.35] font-black">
            قافلة
          </p>
        )}
      </div>
      <p role="status" className="sr-only">
        {label}
      </p>
    </main>
  );
}
