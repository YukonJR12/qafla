"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const RED_ORANGE = "#f42902";

// True once the truck has rolled in on this page load. A module is loaded
// once per page load, so a later launch screen (the moment between signing
// in and the workspace, for example) shows the logo already settled.
let rolled = false;

const logo = {
  src: "/brand/qafla-logo.png",
  width: 1254,
  height: 1254,
  sizes: "(min-width: 640px) 208px, 168px",
};

/**
 * The launch screen (DESIGN.md, Logo): the whole viewport in Red Orange,
 * with the complete official logo centred on a compact Snowy White tile so
 * the red truck stays readable.
 *
 * It is rendered by the server, so it is the first frame, and it is shown
 * only while the app works out who is signed in and where they belong. It
 * leaves the moment that is known: there is no timer.
 *
 * Motion: the truck rolls forward a few pixels and settles, once per page
 * load. The wordmark does not move. The one PNG is drawn twice, each copy
 * clipped to its part (the truck is the top 75% of the image), so the
 * official artwork is used unchanged. The truck faces right in both
 * languages, so the roll is never mirrored.
 *
 * If this takes longer than about 0.7 s, three dots appear under the logo.
 * `label` is announced to a screen reader at once, whatever the motion setting.
 */
export function Splash({ label }: { label: string }) {
  // The same answer on the server and on the first client render, so the
  // markup matches; the flag itself is set once this has been shown.
  const [roll] = useState(() => !rolled);
  useEffect(() => {
    rolled = true;
  }, []);

  return (
    <main className="launch fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-orange">
      {/*
        The colour travels inside the page itself, so the first frame is Red
        Orange even if it is painted before the stylesheet has arrived.
      */}
      {/* React moves this into <head>, and removes it when the launch screen leaves. */}
      <meta name="theme-color" content={RED_ORANGE} />
      <style>{`html:has(.launch),html:has(.launch) body,.launch{background-color:${RED_ORANGE}}.launch{position:fixed;inset:0}`}</style>
      <div className="rounded-poster bg-snowy-white p-3">
        <div className="relative size-42 sm:size-52">
          {/* The truck: the top three quarters of the logo. */}
          <Image {...logo} alt="" preload className={`launch-truck absolute inset-0 size-full ${roll ? "launch-roll" : ""}`} />
          {/* The QAFLA wordmark: the bottom quarter. It stays still. */}
          <Image {...logo} alt="" className="launch-wordmark absolute inset-0 size-full" />
        </div>
      </div>
      {/* Space is kept for the dots, so the logo does not move when they appear. */}
      <div aria-hidden className="launch-wait mt-6 flex h-3 items-center gap-2">
        <span />
        <span />
        <span />
      </div>
      <p role="status" className="sr-only">
        {label}
      </p>
    </main>
  );
}
