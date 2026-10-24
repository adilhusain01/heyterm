// The left column: what needs you first, then every session, then the way to start or bring one back.

import { useMemo, useState } from "react";
import { AttentionQueue } from "../../shared/attention.ts";
import { useCallsign } from "../app-context.tsx";
import { useCallsignStore } from "../state/callsign-store.ts";
import { useServerNow } from "../state/use-server-now.ts";
import { AttentionCard } from "./AttentionCard.tsx";
import { PlusIcon } from "./icons.tsx";
import { StateMark } from "../ui/StateMark.tsx";
import { Tray } from "../ui/Surfaces.tsx";
import { isWaitingOnUser, shortDuration, stateDisplay } from "./session-display.ts";
import type { AgentKind, SessionView } from "../../shared/types.ts";

export function SessionRail() {
  const sessions = useCallsignStore((state) => state.sessions);
  const recentlyClosed = useCallsignStore((state) => state.recentlyClosed);
  const queue = AttentionQueue.build(sessions);
  const head = queue[0];
  const headSession = head ? sessions.find((session) => session.name === head.sessionName) : undefined;
  const ordered = [...sessions].sort((left, right) => attentionRank(queue, left) - attentionRank(queue, right) || left.createdAt - right.createdAt);

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col gap-4 overflow-y-auto border-line bg-panel p-3 md:w-[300px] md:border-r">
      {head && headSession && <AttentionCard item={head} session={headSession} moreWaiting={queue.length - 1} />}
      <div className="flex flex-col gap-1">
        <RailHeading>Sessions</RailHeading>
        {ordered.map((session) => (
          <SessionRow key={session.name} session={session} />
        ))}
        {sessions.length === 0 && <p className="px-2 py-1 text-meta text-ink-faint">None yet.</p>}
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
      className={`flex w-full cursor-pointer flex-col gap-0.5 rounded-inner px-2.5 py-2 text-left transition-colors duration-150 hover:bg-raised ${isFocused ? "bg-raised" : ""}`}
    >
      <span className="flex items-center gap-2.5">
        <StateMark state={session.state} />
        <span className="truncate font-mono text-meta text-ink">{session.name}</span>
        {session.agent !== "claude" && <span className="shrink-0 rounded-mark border border-line px-1 text-[12px] text-ink-faint">{session.agent}</span>}
        <span className={`ml-auto shrink-0 text-[12.5px] ${display.textClass}`}>
          {display.label}
          {isWaitingOnUser(session.state) && <span className="ml-1.5 font-mono text-ink-muted tabular-nums">{shortDuration(now - session.stateSince)}</span>}
        </span>
      </span>
      {detail && <span className="truncate pl-[22px] text-[12.5px] text-ink-faint">{detail}</span>}
    </button>
  );
}

function NewSessionPicker() {
  const { perform } = useCallsign();
  const projects = useCallsignStore((state) => state.projects);
  // Selected whole and filtered here: a selector returning a new array each time re-renders forever.
  const agents = useCallsignStore((state) => state.setup?.agents);
  const installedAgents = useMemo(() => (agents ?? []).filter((agent) => agent.version), [agents]);
  const [isOpen, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [agent, setAgent] = useState<AgentKind>("claude");
  const shown = projects.filter((project) => project.includes(filter.toLowerCase())).slice(0, 12);
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={() => setOpen(!isOpen)} className="flex cursor-pointer items-center gap-2.5 rounded-inner px-2.5 py-2 text-meta text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink">
        <PlusIcon size={14} />
        New session
      </button>
      {isOpen && (
        <Tray className="enter-rise flex flex-col gap-1 p-1">
          {installedAgents.length > 1 && (
            <div role="radiogroup" aria-label="Agent" className="flex gap-1">
              {installedAgents.map((installed) => (
                <button
                  key={installed.kind}
                  type="button"
                  role="radio"
                  aria-checked={agent === installed.kind}
                  onClick={() => setAgent(installed.kind)}
                  className={`h-7 flex-1 cursor-pointer rounded-[4px] text-[12.5px] transition-colors duration-150 ${agent === installed.kind ? "bg-key text-ink shadow-key" : "text-ink-muted hover:bg-raised hover:text-ink"}`}
                >
                  {installed.label}
                </button>
              ))}
            </div>
          )}
          <input
            autoFocus
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Find a project"
            className="h-8 rounded-[4px] border border-line bg-panel px-2.5 text-meta text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
          />
          {shown.map((project) => (
            <button
              key={project}
              type="button"
              onClick={() => {
                perform({ type: "spawn", project, ...(agent === "claude" ? {} : { agent }) });
                setOpen(false);
              }}
              className="cursor-pointer rounded-[4px] px-2.5 py-1.5 text-left font-mono text-meta text-ink hover:bg-raised"
            >
              {project}
            </button>
          ))}
          {shown.length === 0 && <p className="px-2.5 py-1.5 text-meta text-ink-faint">No project matches. Add folders in Setup.</p>}
          <p className="px-2.5 pt-1 pb-1.5 text-[12.5px] text-ink-faint">Or say "start a session in …"</p>
        </Tray>
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
        <button key={name} type="button" onClick={() => perform({ type: "resume", session: name })} className="group flex cursor-pointer items-center gap-2.5 rounded-inner px-2.5 py-1.5 text-left transition-colors duration-150 hover:bg-raised">
          <StateMark state="stopped" />
          <span className="font-mono text-meta text-ink-muted">{name}</span>
          <span className="ml-auto text-[12.5px] text-ink-faint group-hover:text-ink">Bring back</span>
        </button>
      ))}
    </div>
  );
}

function RailHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="px-2.5 pb-0.5 text-meta font-medium text-ink-muted">{children}</h2>;
}

function attentionRank(queue: ReturnType<typeof AttentionQueue.build>, session: SessionView): number {
  const index = queue.findIndex((item) => item.sessionName === session.name);
  return index === -1 ? queue.length + (session.state === "working" ? 0 : 1) : index;
}
