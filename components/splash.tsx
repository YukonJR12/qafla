"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// True once the logo has rolled in on this page load. A module is loaded
// once per page load, so a later launch screen (the moment between signing
// in and the workspace, for example) shows the logo already settled.
let rolled = false;

/**
 * The launch screen (DESIGN.md, Logo): the whole viewport in Snowy White
 * with the complete official logo in the centre, straight on the white.
 *
 * It is rendered by the server, so it is the first frame, and it is shown
 * only while the app works out who is signed in and where they belong. It
 * leaves the moment that is known: there is no timer.
 *
 * Motion: the logo itself is the loading animation. The truck and its
 * wordmark move as one piece: they start a little left of centre, roll
 * forward and ease to a stop, once per page load. The truck faces right in
 * both languages, so the roll is never mirrored.
 *
 * If this takes longer than about 0.7 s, a small bar appears under the
 * logo. `label` is announced to a screen reader at once, whatever the
 * motion setting.
 */
export function Splash({ label }: { label: string }) {
  // The same answer on the server and on the first client render, so the
  // markup matches; the flag itself is set once this has been shown.
  const [roll] = useState(() => !rolled);
  useEffect(() => {
    rolled = true;
  }, []);

  return (
    <main className="launch fixed inset-0 z-50 flex flex-col items-center justify-center bg-snowy-white">
      {/*
        The colour and the position travel inside the page itself, so the
        first frame is right even if it is painted before the stylesheet.
      */}
      <style>{`.launch{position:fixed;inset:0;background-color:#fdfdff}`}</style>
      <Image
        src="/brand/qafla-logo.png"
        alt=""
        width={1254}
        height={1254}
        sizes="(min-width: 640px) 256px, 224px"
        preload
        className={`aspect-square h-auto w-56 max-w-[56vw] sm:w-64 ${roll ? "launch-roll" : ""}`}
      />
      {/* Space is kept for the bar, so the logo does not move when it appears. */}
      <div aria-hidden className="launch-wait mt-6" />
      <p role="status" className="sr-only">
        {label}
      </p>
    </main>
  );
}
