import { Splash } from "@/components/splash";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";

// First launch: the Qafla logo on Snowy White.
//
// Nobody stays on this page. The launch gate (components/session-gate.tsx)
// restores the saved session and then sends a signed-out visitor to
// sign-in, a customer to Explore, a vendor to the Kitchen and the manager
// to the park overview.
export default async function Launch() {
  const t = dictionary[await getLocale()];
  return <Splash label={t.restoring} />;
}
