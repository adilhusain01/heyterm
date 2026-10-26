// Copies a command or an output to the clipboard, and says so: the copy icon turns into a check
// for a moment. Both icons share one grid cell and cross-fade, so the button never changes size, and
// it carries no position of its own, so a caller can place it absolutely.

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "./icons.tsx";

type CopyState = "idle" | "copied" | "failed";

const copiedForMilliseconds = 1_500;
const iconSwap = "transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

export function CopyButton({ text, className = "" }: { text: () => string; className?: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), copiedForMilliseconds);
    return () => window.clearTimeout(timer);
  }, [copyState]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };
  const label = copyState === "copied" ? "Copied" : copyState === "failed" ? "Could not copy" : "Copy";
  const isCopied = copyState === "copied";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => void copy()}
      className={`press grid size-6 shrink-0 cursor-pointer place-items-center rounded-tiny text-ink-faint transition-[background-color,color] duration-150 hover:bg-raised hover:text-ink ${copyState === "failed" ? "text-failed" : ""} ${className}`}
    >
      <CopyIcon size={14} className={`[grid-area:1/1] ${iconSwap} ${isCopied ? "scale-25 opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-[0px]"}`} />
      <CheckIcon size={14} className={`[grid-area:1/1] text-finished ${iconSwap} ${isCopied ? "scale-100 opacity-100 blur-[0px]" : "scale-25 opacity-0 blur-[4px]"}`} />
    </button>
  );
}
