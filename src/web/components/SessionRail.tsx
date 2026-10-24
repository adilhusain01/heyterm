// The left column: what needs you first, then every session, then the way to start or bring one back.

import { useState } from "react";
import { AttentionQueue } from "../../shared/attention.ts";
import { useCallsign } from "../app-context.tsx";
import { useCallsignStore } from "../state/callsign-store.ts";
import { useServerNow } from "../state/use-server-now.ts";
import { AttentionCard } from "./AttentionCard.tsx";
import { PlusIcon } from "./icons.tsx";
import { isWaitingOnUser, shortDuration, stateDisplay } from "./session-display.ts";
import type { SessionView } from "../../shared/types.ts";

export function SessionRail() {
  const sessions = useCallsignStore((state) => state.sessions);
  const recentlyClosed = useCallsignStore((state) => state.recentlyClosed);
  const queue = AttentionQueue.build(sessions);
  const head = queue[0];
  const headSession = head ? sessions.find((session) => session.name === head.sessionName) : undefined;
  const ordered = [...sessions].sort((left, right) => attentionRank(queue, left) - attentionRank(queue, right) || left.createdAt - right.createdAt);

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col gap-3 overflow-y-auto border-line bg-panel p-3 md:w-[300px] md:border-r">
      {head && headSession && <AttentionCard item={head} session={headSession} moreWaiting={queue.length - 1} />}
      <div className="flex flex-col gap-1">
        <RailHeading>Sessions</RailHeading>
        {ordered.map((session) => (
          <SessionRow key={session.name} session={session} />
        ))}
        {sessions.length === 0 && <p className="px-2 py-1 text-[12px] text-ink-faint">None yet.</p>}
      </div>
      <NewSessionPicker />
      {recentlyClosed.length > 0 && <RecentlyClosed names={recentlyClosed.map((closed) => closed.name)} />}
    </aside>
  );
}

function SessionRow({ session }: { session: SessionView }) {
  const { perform } = useCallsign();
  const focusedSession = useCallsignStore((state) => state.focusedSession);
  const now = useServerNow();
  const display = stateDisplay[session.state];
  const isFocused = focusedSession === session.name;
  const detail = session.pending?.kind === "permission" ? session.pending.summary : (session.lastPrompt ?? "");
  return (
    <button
      type="button"
      onClick={() => perform({ type: "focus", session: session.name })}
      className={`flex w-full cursor-pointer flex-col gap-0.5 rounded-inner px-2 py-1.5 text-left hover:bg-raised ${isFocused ? "bg-raised" : ""}`}
    >
      <span className="flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-mark ${display.markClass}`} />
        <span className="truncate font-mono text-[13px] text-ink">{session.name}</span>
        <span className={`ml-auto shrink-0 text-[11px] ${display.textClass}`}>
          {display.label}
          {isWaitingOnUser(session.state) && <span className="ml-1.5 font-mono text-ink-muted tabular-nums">{shortDuration(now - session.stateSince)}</span>}
        </span>
      </span>
      {detail && <span className="truncate pl-4 text-[12px] text-ink-faint">{detail}</span>}
    </button>
  );
}

function NewSessionPicker() {
  const { perform } = useCallsign();
  const projects = useCallsignStore((state) => state.projects);
  const [isOpen, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const shown = projects.filter((project) => project.includes(filter.toLowerCase())).slice(0, 12);
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={() => setOpen(!isOpen)} className="flex cursor-pointer items-center gap-2 rounded-inner px-2 py-1.5 text-[13px] text-ink-muted hover:bg-raised hover:text-ink">
        <PlusIcon size={14} />
        New session
        <span className="ml-auto text-[11px] text-ink-faint">or say "start a session in …"</span>
      </button>
      {isOpen && (
        <div className="flex flex-col gap-1 rounded-outer border border-line bg-canvas p-1">
          <input
            autoFocus
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Find a project"
            className="h-8 rounded-inner border border-line bg-panel px-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
          />
          {shown.map((project) => (
            <button
              key={project}
              type="button"
              onClick={() => {
                perform({ type: "spawn", project });
                setOpen(false);
              }}
              className="cursor-pointer rounded-inner px-2.5 py-1.5 text-left font-mono text-[12px] text-ink hover:bg-raised"
            >
              {project}
            </button>
          ))}
          {shown.length === 0 && <p className="px-2.5 py-1.5 text-[12px] text-ink-faint">No project matches. Add folders in Setup.</p>}
        </div>
      )}
    </div>
  );
}

function RecentlyClosed({ names }: { names: string[] }) {
  const { perform } = useCallsign();
  return (
    <div className="flex flex-col gap-1">
      <RailHeading>Recently closed</RailHeading>
      {names.slice(0, 5).map((name) => (
        <button key={name} type="button" onClick={() => perform({ type: "resume", session: name })} className="flex cursor-pointer items-center rounded-inner px-2 py-1 text-left hover:bg-raised">
          <span className="font-mono text-[12px] text-ink-muted">{name}</span>
          <span className="ml-auto text-[11px] text-ink-faint">Bring back</span>
        </button>
      ))}
    </div>
  );
}

function RailHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="px-2 pt-1 text-[12px] font-medium text-ink-muted">{children}</h2>;
}

function attentionRank(queue: ReturnType<typeof AttentionQueue.build>, session: SessionView): number {
  const index = queue.findIndex((item) => item.sessionName === session.name);
  return index === -1 ? queue.length + (session.state === "working" ? 0 : 1) : index;
}
