// "Catch me up": what each session did since you last looked, while the same text is read out.

import { useEffect } from "react";
import { useCallsign } from "../app-context.tsx";
import { useCallsignStore } from "../state/callsign-store.ts";
import { CloseIcon } from "./icons.tsx";
import { stateDisplay } from "./session-display.ts";

export function CatchUpPanel() {
  const { perform } = useCallsign();
  const digests = useCallsignStore((state) => state.catchUp);
  const closeCatchUp = useCallsignStore((state) => state.closeCatchUp);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && closeCatchUp();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeCatchUp]);

  if (!digests) return null;
  return (
    <section aria-label="Catch up" className="enter-rise absolute inset-x-2 top-2 z-30 mx-auto flex max-h-[70%] max-w-[720px] flex-col gap-1 overflow-y-auto rounded-outer border border-line-strong bg-panel p-1">
      <header className="flex items-center px-3 pt-2 pb-1">
        <h2 className="text-[14px] font-medium text-ink">Since you last looked</h2>
        <button type="button" aria-label="Close" onClick={closeCatchUp} className="press ml-auto flex size-7 cursor-pointer items-center justify-center rounded-inner text-ink-muted hover:bg-raised hover:text-ink">
          <CloseIcon size={14} />
        </button>
      </header>
      {digests.length === 0 && <p className="px-3 pb-2 text-meta text-ink-muted">Nothing new.</p>}
      {digests.map((digest) => {
        const display = stateDisplay[digest.state];
        return (
          <button
            key={digest.sessionName}
            type="button"
            onClick={() => {
              perform({ type: "focus", session: digest.sessionName });
              closeCatchUp();
            }}
            className="flex cursor-pointer flex-col gap-1 rounded-inner bg-raised px-3 py-2.5 text-left hover:bg-line"
          >
            <span className="flex items-center gap-2">
              <span className={`size-2 rounded-mark ${display.markClass}`} />
              <span className="font-mono text-meta text-ink">{digest.sessionName}</span>
              <span className={`text-[12.5px] ${display.textClass}`}>{display.label}</span>
              <span className="ml-auto text-[12.5px] text-ink-faint">
                {plural(digest.commands.length, "command")}, {plural(digest.changedFiles.length, "file")}
              </span>
            </span>
            {digest.lead && <span className="text-meta leading-snug text-ink-muted">{digest.lead}</span>}
            {digest.changedFiles.length > 0 && <span className="truncate font-mono text-[12.5px] text-ink-faint">{digest.changedFiles.join("  ")}</span>}
          </button>
        );
      })}
    </section>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
