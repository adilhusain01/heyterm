// The name beside an item in the folded sidebar, which shows only faces and icons. Drawn above
// everything to the item's right. The first one waits a moment so a passing pointer shows nothing;
// once one is up, its neighbours show at once, so running down the rail reads like a list.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const firstShowDelayMilliseconds = 300;
const showAtOnceWithinMilliseconds = 600;
const screenMargin = 8;
let lastLabelHiddenAt = 0;

export function RailLabel({ label, children, className = "flex", disabled = false }: { label: ReactNode; children: ReactNode; className?: string; disabled?: boolean }) {
  const [isShown, setShown] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | undefined>(undefined);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = () => {
    clearTimeout(showTimer.current);
    const showsAtOnce = Date.now() - lastLabelHiddenAt < showAtOnceWithinMilliseconds;
    showTimer.current = setTimeout(() => setShown(true), showsAtOnce ? 0 : firstShowDelayMilliseconds);
  };
  const hide = () => {
    clearTimeout(showTimer.current);
    setShown((wasShown) => {
      if (wasShown) lastLabelHiddenAt = Date.now();
      return false;
    });
  };

  useEffect(() => () => clearTimeout(showTimer.current), []);

  useLayoutEffect(() => {
    if (!isShown || !anchorRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const labelHeight = labelRef.current?.offsetHeight ?? 32;
    const centredTop = anchor.top + anchor.height / 2 - labelHeight / 2;
    const top = Math.min(Math.max(screenMargin, centredTop), window.innerHeight - labelHeight - screenMargin);
    setPosition({ top, left: anchor.right + 8 });
  }, [isShown]);

  return (
    <span ref={anchorRef} className={className} onPointerEnter={show} onPointerLeave={hide} onPointerDown={hide} onFocus={show} onBlur={hide}>
      {children}
      {isShown &&
        !disabled &&
        createPortal(
          <div
            ref={labelRef}
            aria-hidden
            className="pointer-events-none fixed z-50 flex max-w-[280px] flex-col gap-0.5 rounded-inner border border-line-strong bg-canvas px-2.5 py-1.5 text-meta text-ink"
            style={{ top: position?.top ?? -9999, left: position?.left ?? -9999 }}
          >
            {label}
          </div>,
          document.body,
        )}
    </span>
  );
}
