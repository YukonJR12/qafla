"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// EasyUI Sheet's handle-only drag and dismissal threshold, adapted to a
// non-modal map panel: the park remains available and its camera stays mounted.
export function TruckSheet({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; time: number } | null>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  return <section ref={panel} role="dialog" tabIndex={-1} aria-label={title} className="truck-sheet max-h-[36dvh] shrink-0 overflow-y-auto rounded-t-[24px] border-t border-divider bg-snowy-white px-4 pb-3 shadow-[0_-4px_18px_#1010100d]" style={{ translate: `0 ${offset}px` }}>
    <button type="button" aria-label={closeLabel} className="flex min-h-11 w-full touch-none items-center justify-center" onClick={onClose}
      onPointerDown={e => { e.stopPropagation(); drag.current = { y: e.clientY, time: performance.now() }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (drag.current) setOffset(Math.max(0, e.clientY - drag.current.y)); }}
      onPointerCancel={() => { drag.current = null; setOffset(0); }}
      onPointerUp={e => { const start = drag.current; drag.current = null; setOffset(0); if (start && (e.clientY - start.y > 96 || (e.clientY - start.y) / Math.max(1, performance.now() - start.time) > .5)) onClose(); }}>
      <span aria-hidden className="h-1 w-10 rounded-full bg-outline" />
    </button>
    {children}
  </section>;
}
