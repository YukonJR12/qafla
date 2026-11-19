import Image from "next/image";
import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { ArrowForward, primaryButton } from "@/components/ui";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";

// Welcome: the park logo on Snowy White and one way forward.
export default async function Welcome() {
  const locale = await getLocale();
  const t = dictionary[locale];

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-8 md:px-6">
      <div className="flex justify-end pt-3">
        <LanguageSwitch />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="sr-only">{t.appName}</h1>
        <Image
          src="/brand/qafla-logo.png"
          alt=""
          width={1254}
          height={1254}
          sizes="(min-width: 640px) 288px, 224px"
          className="h-auto w-56 max-w-full sm:w-72"
          preload
        />
        {locale === "en" && (
          <p lang="ar" dir="rtl" className="font-arabic text-4xl leading-[1.35] font-black">
            قافلة
          </p>
        )}
        <p className="max-w-[28ch] text-lg text-balance text-muted">{t.welcomeLine}</p>
      </div>

      <div className="space-y-3">
        <Link href="/explore" className={primaryButton}>
          {t.exploreTrucks}
          <ArrowForward className="size-5" />
        </Link>
        <p className="text-center text-sm text-muted">{t.parkHours}</p>
      </div>
    </main>
  );
}
