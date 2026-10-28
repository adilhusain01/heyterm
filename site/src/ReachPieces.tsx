// Slices of the interface for what came after 0.1.11: any folder, a server's sessions, updates that
// keep the sessions, and the assistant's permissions. Two answer a press the way the app does.

import { useEffect, useRef, useState } from "react";
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
    running: "HeyTerm 0.1.11",
    restarting: "Restarting into 0.1.13…",
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
