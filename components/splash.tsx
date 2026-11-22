"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * The launch screen (DESIGN.md, Logo): the whole viewport in Snowy White
 * with the complete official logo in the centre, straight on the white.
 *
 * It is rendered by the server, so it is the first frame, and it is shown
 * while the app restores the session. The destination mounts immediately
 * when ready; the departing layer never intercepts input or waits on a timer.
 *
 * Motion: the logo itself is the loading animation. The truck and its
 * wordmark move as one piece: they start a little left of centre, roll
 * forward on first paint and ease to a stop, once per page load. The inline
 * image needs no network request or hydration to appear. The truck faces right in
 * both languages, so the roll is never mirrored.
 *
 * If this takes longer than about 0.7 s, a small bar appears under the
 * logo. `label` is announced to a screen reader at once, whatever the
 * motion setting.
 */
export function Splash({ label, image, active = true }: { label: string; image: string; active?: boolean }) {
  const [departed, setDeparted] = useState(false);
  if (!active && departed) return null;

  return (
    <div
      aria-hidden={!active || undefined}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === "launch-handoff") setDeparted(true);
      }}
      className={`launch fixed inset-0 z-50 flex flex-col items-center justify-center bg-snowy-white ${!active ? "launch-handoff pointer-events-none" : ""}`}
    >
      {/*
        The colour and the position travel inside the page itself, so the
        first frame is right even if it is painted before the stylesheet.
      */}
      <style>{`.launch{position:fixed;inset:0;background-color:#fdfdff}`}</style>
      <Image
        src={image}
        alt=""
        width={1254}
        height={1254}
        sizes="(min-width: 640px) 256px, 224px"
        unoptimized
        loading="eager"
        decoding="sync"
        className={`aspect-square h-auto w-56 max-w-[56vw] sm:w-64 ${departed ? "" : "launch-roll"}`}
      />
      {/* Space is kept for the bar, so the logo does not move when it appears. */}
      <div aria-hidden className="launch-wait mt-6" />
      <p role="status" className="sr-only">
        {label}
      </p>
    </div>
  );
}
