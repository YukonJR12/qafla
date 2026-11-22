"use client";

import type { ButtonHTMLAttributes } from "react";
import { CheckIcon } from "./ui";
import "./vendor-feedback.css";

/** EasyUI Morphing Button interaction, using Qafla's native button and reduced-motion CSS. */
export function MorphingButton({ state, labels, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  state: "idle" | "pending" | "success" | "retry";
  labels: Record<"idle" | "pending" | "success" | "retry", string>;
}) {
  return <button {...props} disabled={props.disabled || state === "pending"} aria-busy={state === "pending"}>
    <span className="vendor-morph grid min-w-0" aria-live="polite" aria-atomic="true">
      {Object.entries(labels).map(([key, label]) => <span key={key} aria-hidden="true" className="invisible col-start-1 row-start-1 px-3">{label}</span>)}
      <span key={state} className="vendor-morph-label col-start-1 row-start-1 flex items-center justify-center gap-2">
        {state === "success" && <CheckIcon className="size-5 shrink-0" />}{labels[state]}
      </span>
    </span>
  </button>;
}
