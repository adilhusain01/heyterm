// A "?" beside a heading that opens a small card explaining it, so headings stay short. The card is
// drawn above everything else, so a scrolling sidebar never cuts it off, and kept on screen.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HelpIcon } from "./icons.tsx";

const cardWidth = 280;
const screenMargin = 12;

export function HelpTip({ title, children }: { title: string; children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const anchor = buttonRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(screenMargin, anchor.left - 8), window.innerWidth - cardWidth - screenMargin);
    const cardHeight = cardRef.current?.offsetHeight ?? 160;
    const below = anchor.bottom + 6;
    const top = below + cardHeight > window.innerHeight - screenMargin ? Math.max(screenMargin, anchor.top - cardHeight - 6) : below;
    setPosition({ top, left });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!cardRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${title}`}
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        className={`flex size-5 cursor-pointer items-center justify-center rounded-tiny transition-colors duration-150 hover:bg-raised hover:text-ink ${isOpen ? "text-ink" : "text-ink-faint"}`}
      >
        <HelpIcon size={13} />
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={cardRef}
            role="dialog"
            aria-label={title}
            className="enter-rise fixed z-50 flex flex-col gap-1.5 rounded-inner border border-line-strong bg-canvas p-3 text-left"
            style={{ width: cardWidth, top: position?.top ?? -9999, left: position?.left ?? -9999 }}
          >
            <span className="text-meta font-medium text-ink">{title}</span>
            <span className="flex flex-col gap-2 text-small leading-relaxed text-ink-muted">{children}</span>
          </div>,
          document.body,
        )}
    </>
  );
}

// A phrase to say, set apart in the help text.
export function SayThis({ children }: { children: ReactNode }) {
  return <span className="rounded-tiny border border-line bg-tray px-1 py-px font-mono text-small whitespace-nowrap text-ink">"{children}"</span>;
}
