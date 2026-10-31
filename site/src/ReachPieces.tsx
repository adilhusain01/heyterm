// Slices of the interface for how far HeyTerm reaches: any folder, a server's sessions, an even grid,
// a terminal that fits the pane in use, updates that keep the sessions, and the assistant's
// permissions. Some answer a press the way the app does.

import { useEffect, useRef, useState } from "react";
import { GridLayout } from "../../src/web/components/grid-layout.ts";
import { CheckIcon, FolderIcon } from "../../src/web/ui/icons.tsx";
import { Segmented } from "../../src/web/ui/Segmented.tsx";
import { Face } from "./Face.tsx";

// The + picker: Choose a folder first, then the projects.
export function AnyFolderPiece() {
  return (
    <div className="flex flex-col gap-1 rounded-inner border border-line bg-tray p-1 shadow-tray">
      <span className="flex items-center gap-2 rounded-tiny bg-raised px-2 py-1.5 text-meta text-ink">
        <FolderIcon size={16} className="shrink-0" />
        Choose a folder…
      </span>
      {["docs", "shop", "web"].map((project) => (
        <span key={project} className="flex items-center gap-2 px-2 py-1 font-mono text-meta text-ink-muted">
          <Face name={project} size={18} />
          {project}
        </span>
      ))}
    </div>
  );
}

// A session on the VPS sits beside the ones on this computer, named after its computer.
export function ServerSessionsPiece() {
  const rows = [
    { shown: "web", face: "web", where: undefined, state: "Working", tone: "text-working" },
    { shown: "vps/mobile", face: "mobile", where: "on vps", state: "Needs a permission", tone: "text-permission" },
  ] as const;
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.shown} className="flex items-center gap-2.5 rounded-inner bg-raised px-2.5 py-2">
          <Face name={row.face} state={row.state === "Working" ? "working" : "needs_permission"} size={26} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-mono text-meta text-ink">{row.shown}</span>
              {row.where && <span className="shrink-0 text-small text-ink-faint">{row.where}</span>}
            </span>
            <span className={`text-small ${row.tone}`}>{row.state}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const gridSessions = ["api", "docs", "shop", "web", "mobile", "tests"];
const widestGridColumns = 3;

// The app's own rule picks the columns, so the rows come out as they do in the grid.
export function EvenGridPiece() {
  const [paneCount, setPaneCount] = useState("4");
  const panes = gridSessions.slice(0, Number(paneCount));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="text-small text-ink-faint">Sessions</span>
        <div className="min-w-0 flex-1">
          <Segmented label="How many sessions" value={paneCount} onChange={setPaneCount} options={["3", "4", "5", "6"].map((count) => ({ value: count, label: count }))} stretch />
        </div>
      </div>
      <div className="grid h-[76px] auto-rows-fr gap-1" style={{ gridTemplateColumns: `repeat(${GridLayout.columns(panes.length, widestGridColumns)}, minmax(0, 1fr))` }} aria-hidden="true">
        {panes.map((name) => (
          <span key={name} className="flex min-w-0 items-center justify-center rounded-small border border-line-strong bg-terminal">
            <Face name={name} size={20} />
          </span>
        ))}
      </div>
    </div>
  );
}

// Columns measured on a Mac: one session half-width in the grid, and alone at full width in another tab.
const paneSizes = {
  half: { columns: 106, name: "This tab" },
  full: { columns: 218, name: "Another tab" },
} as const;

// One session open in two tabs. The terminal takes the size of the one typed in last.
export function FollowsThePanePiece() {
  const [typingIn, setTypingIn] = useState<keyof typeof paneSizes>("half");
  const { columns, name } = paneSizes[typingIn];
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label="Which tab you type in"
        value={typingIn}
        onChange={setTypingIn}
        options={[
          { value: "half", label: "Half-width pane" },
          { value: "full", label: "Full-width pane" },
        ]}
        stretch
      />
      <div className="rounded-small bg-tray p-1 shadow-tray" aria-hidden="true">
        <span className="block h-8 rounded-tiny border border-line-strong bg-terminal transition-[width] duration-200 ease-out motion-reduce:transition-none" style={{ width: `${(columns / paneSizes.full.columns) * 100}%` }} />
      </div>
      <p key={typingIn} className="status-swap text-small text-ink-muted" aria-live="polite">
        {name} is in use: the terminal is {columns} columns wide.
      </p>
    </div>
  );
}

type UpdateStage = "running" | "restarting" | "updated";

// An update restarts HeyTerm's server; the sessions, held by its keeper, keep working through it.
export function UpdatesKeepSessionsPiece() {
  const [stage, setStage] = useState<UpdateStage>("running");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const update = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setStage("restarting");
    timers.current = [window.setTimeout(() => setStage("updated"), 1200)];
  };
  const words: Record<UpdateStage, string> = {
    running: "A new version is ready.",
    restarting: "Restarting into it…",
    updated: "Updated. Every session kept working.",
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" aria-hidden="true">
        {["api", "docs", "shop"].map((name) => (
          <span key={name} className="flex items-center gap-1.5 rounded-small bg-raised px-2 py-1">
            <Face name={name} state="working" size={18} />
            <span className="text-small text-working">Working</span>
          </span>
        ))}
      </div>
      <p key={stage} className="status-swap flex items-center gap-2 text-small text-ink" aria-live="polite">
        {stage === "updated" && <CheckIcon size={14} className="shrink-0 text-finished" />}
        {words[stage]}
      </p>
      <button
        type="button"
        onClick={update}
        disabled={stage === "restarting"}
        className="press key-lift inline-flex h-7 w-fit cursor-pointer items-center rounded-small border border-line-strong bg-key px-2.5 text-small text-ink shadow-key hover:bg-key-hover disabled:cursor-default disabled:opacity-60"
      >
        {stage === "updated" ? "Update again" : "Update HeyTerm"}
      </button>
    </div>
  );
}

// Setup's choice for the assistant: ask when Claude Code would, or act without asking.
export function FullAccessPiece() {
  const [choice, setChoice] = useState<"ask" | "full">("ask");
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label="The assistant's permissions"
        value={choice}
        onChange={setChoice}
        options={[
          { value: "ask", label: "Asks like Claude Code" },
          { value: "full", label: "Full access" },
        ]}
      />
      <p key={choice} className="status-swap text-small text-ink-muted" aria-live="polite">
        {choice === "ask" ? "It asks you out loud before a risky step." : "It acts without asking. It still never opens PrivateKeys."}
      </p>
    </div>
  );
}
