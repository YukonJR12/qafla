
// First launch: the Qafla logo on Snowy White.
//
// Nobody stays on this page. The launch gate (components/session-gate.tsx)
// restores the saved session and then sends a signed-out visitor to
// sign-in, a customer to Explore, a vendor to the Kitchen and the manager
// to the park overview.
export default function Launch() {
  // SessionGate owns one persistent logo across restoration and navigation.
  return null;
}
