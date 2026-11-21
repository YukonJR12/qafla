"use client";

import { useEffect, useLayoutEffect } from "react";

// How far down each remembered screen was, kept only in memory: it lasts
// while the app stays open in this tab and is gone after a fresh launch,
// so a new visit always starts at the top.
const positions = new Map<string, number>();

/**
 * Remembers how far down a screen was scrolled and puts the customer back
 * there when they return to it (for example, back from a truck's menu to
 * the same place in the list of trucks). Renders nothing.
 */
export function ScrollMemory({ id }: { id: string }) {
  // Listening starts and stops in a layout effect, so it has already stopped
  // when the next screen scrolls itself to the top. Otherwise that jump
  // would be remembered as this screen's position.
  useLayoutEffect(() => {
    const remember = () => positions.set(id, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [id]);

  useEffect(() => {
    const saved = positions.get(id);
    if (!saved) return;
    // Two frames: the router scrolls a new screen to the top first.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => window.scrollTo(0, saved));
    });
    return () => cancelAnimationFrame(frame);
  }, [id]);
  return null;
}
