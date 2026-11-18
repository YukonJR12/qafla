import Image from "next/image";

// Placeholder home route. The real customer screens come from Google Stitch.
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-snowy-white px-4 text-center text-ink">
      <h1 className="sr-only">Qafla Pickup</h1>
      <Image
        src="/brand/qafla-logo.png"
        alt=""
        width={1254}
        height={1254}
        sizes="(min-width: 640px) 288px, 224px"
        className="h-auto w-56 max-w-full sm:w-72"
        preload
      />
      <p lang="ar" dir="rtl" className="font-arabic text-4xl font-black sm:text-6xl">
        قافلة
      </p>
    </main>
  );
}
