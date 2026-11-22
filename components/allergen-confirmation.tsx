"use client";

import "./vendor-feedback.css";

/** EasyUI DrawCheckbox: the native labelled input owns focus and keyboard behaviour. */
export function AllergenConfirmation({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="vendor-check mt-3 flex min-h-11 cursor-pointer items-center gap-3 font-bold text-ink">
    <span className="relative size-6 shrink-0">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="absolute inset-0 size-6 cursor-pointer appearance-none rounded border-2 border-ink checked:bg-ink" />
      <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute inset-0 size-6 fill-none stroke-snowy-white stroke-[2.5]"><path d="m5 12 4 4 10-10" /></svg>
    </span>{label}
  </label>;
}
