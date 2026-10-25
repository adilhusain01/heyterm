// The parts of a sidebar row that tell sessions apart: a details card shown on hover, a rename
// field, and the small buttons that appear on a hovered or focused row.

import { useState, type ReactNode } from "react";
import { SessionNames } from "../../shared/session-names.ts";
import { useHeyTerm } from "../app-context.tsx";
import { useServerNow } from "../state/use-server-now.ts";
import { SessionFacts, type SessionFactsInput } from "./session-facts.ts";

export function SessionDetailsCard({ name, facts, hint }: { name: string; facts: SessionFactsInput; hint: string }) {
  const now = useServerNow();
  const rows = SessionFacts.rows(facts, now);
  return (
    <span className="flex w-[256px] flex-col gap-2 py-0.5">
      <span className="font-mono text-meta text-ink">{name}</span>
      <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-small">
        {rows.map((row) => (
          <span key={row.label} className="contents">
            <span className="text-ink-faint">{row.label}</span>
            {/* A folder breaks after a slash, never inside a folder's name. */}
            <span className={`text-ink ${row.isCode ? "font-mono break-all" : "break-words"}`}>{row.label === "Folder" ? row.value.replaceAll("/", "/\u200B") : row.value}</span>
          </span>
        ))}
      </span>
      <span className="text-small text-ink-faint">{hint}</span>
    </span>
  );
}

// Enter saves, Escape or leaving the field keeps the old name. The server checks the name again.
export function RenameField({ currentName, takenNames, onDone }: { currentName: string; takenNames: string[]; onDone: () => void }) {
  const { perform } = useHeyTerm();
  const [text, setText] = useState(currentName);
  const newName = SessionNames.fromTyped(text);
  const problem = newName === currentName ? undefined : SessionNames.renameProblem(newName, currentName, takenNames);
  const save = () => {
    if (newName === currentName) return onDone();
    if (problem) return;
    perform({ type: "rename", session: currentName, newName });
    onDone();
  };
  const hint = problem ?? (newName && newName !== text ? `Saved as ${newName}` : "Enter to save, Esc to keep the old name");
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <input
        autoFocus
        aria-label={`New name for ${currentName}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={onDone}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();
          if (event.key === "Escape") onDone();
        }}
        className="w-full min-w-0 rounded-tiny border border-line-strong bg-canvas px-1.5 py-0.5 font-mono text-meta text-ink outline-none focus-visible:border-accent"
      />
      <span role={problem ? "alert" : undefined} className={`text-small ${problem ? "text-failed" : "text-ink-faint"}`}>
        {hint}
      </span>
    </span>
  );
}

// Shown on the row's right edge while it is hovered or holds focus, so a passing pointer stays quiet.
export function RowActions({ children }: { children: ReactNode }) {
  return <span className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5 rounded-inner bg-raised opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">{children}</span>;
}

export function RowActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="press flex size-7 cursor-pointer items-center justify-center rounded-small text-ink-faint transition-colors duration-150 hover:bg-key hover:text-ink">
      {children}
    </button>
  );
}
