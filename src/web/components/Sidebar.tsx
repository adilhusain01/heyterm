// The left side: what needs you first, every session, starting and bringing sessions back, and the
// controls that used to sit in a top bar. Folds to a rail of session faces.

import { useMemo, useState } from "react";
import { AttentionQueue } from "../../shared/attention.ts";
import { useCallsign } from "../app-context.tsx";
import { isPlayground } from "../playground/is-playground.ts";
import { useCallsignStore } from "../state/callsign-store.ts";
import { useServerNow } from "../state/use-server-now.ts";
import { HelpTip, SayThis } from "../ui/HelpTip.tsx";
import { BringBackIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PlusIcon, SettingsIcon, SpeakerIcon, SpeakerMutedIcon, SpeakerQuietIcon } from "../ui/icons.tsx";
import { SessionAvatar } from "../ui/SessionAvatar.tsx";
import { Tray } from "../ui/Surfaces.tsx";
import { AttentionCard } from "./AttentionCard.tsx";
import { isWaitingOnUser, shortDuration, stateDisplay } from "./session-display.ts";
import type { AgentKind, AnnouncementMode, SessionView } from "../../shared/types.ts";

const nextMode: Record<AnnouncementMode, AnnouncementMode> = { speak: "quiet", quiet: "mute", mute: "speak" };
const modeLabel: Record<AnnouncementMode, string> = { speak: "Speaking", quiet: "Quiet", mute: "Muted" };

export function Sidebar({ onOpenSetup }: { onOpenSetup: () => void }) {
  const collapsed = useCallsignStore((state) => state.layout.sidebarCollapsed);
  return collapsed ? <SidebarRail onOpenSetup={onOpenSetup} /> : <SidebarPanel onOpenSetup={onOpenSetup} />;
}

function useOrderedSessions() {
  const sessions = useCallsignStore((state) => state.sessions);
  return useMemo(() => {
    const queue = AttentionQueue.build(sessions);
    const ordered = [...sessions].sort((left, right) => attentionRank(queue, left) - attentionRank(queue, right) || left.createdAt - right.createdAt);
    return { queue, ordered };
  }, [sessions]);
}

function SidebarPanel({ onOpenSetup }: { onOpenSetup: () => void }) {
  const sessions = useCallsignStore((state) => state.sessions);
  const recentlyClosed = useCallsignStore((state) => state.recentlyClosed);
  const changeLayout = useCallsignStore((state) => state.changeLayout);
  const { queue, ordered } = useOrderedSessions();
  const head = queue[0];
  const headSession = head ? sessions.find((session) => session.name === head.sessionName) : undefined;
  const [isPickerOpen, setPickerOpen] = useState(false);

  return (
    <aside className="flex max-h-[45vh] min-h-0 w-full shrink-0 flex-col border-b border-line bg-panel md:max-h-none md:w-[280px] md:border-r md:border-b-0">
      <header className="flex h-12 shrink-0 items-center gap-2 px-3">
        <span className="font-mono text-meta font-medium tracking-tight text-ink">callsign</span>
        <ConnectionMark />
        {isPlayground && <span className="rounded-mark border border-line px-1.5 text-[12px] text-ink-muted">Playground</span>}
        <RailButton label="Fold the sidebar" onClick={() => changeLayout({ sidebarCollapsed: true })} className="ml-auto hidden md:flex">
          <PanelLeftCloseIcon size={16} />
        </RailButton>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
        {head && headSession && <AttentionCard item={head} session={headSession} moreWaiting={queue.length - 1} />}

        <section className="flex flex-col gap-0.5">
          <SectionHeading
            title="Sessions"
            help={
              <>
                <span>Every coding agent running in Callsign, and Claude sessions from your own terminals if Setup shows them. The ones that need you come first.</span>
                <span>Name one to talk to it: <SayThis>portfolio, run the tests</SayThis>, or <SayThis>start a codex session in api</SayThis>.</span>
              </>
            }
            action={
              <RailButton label="New session" onClick={() => setPickerOpen(!isPickerOpen)}>
                <PlusIcon size={15} />
              </RailButton>
            }
          />
          {isPickerOpen && <NewSessionPicker onDone={() => setPickerOpen(false)} />}
          {ordered.map((session) => (
            <SessionRow key={session.name} session={session} />
          ))}
          {sessions.length === 0 && !isPickerOpen && <p className="px-2.5 py-1 text-meta text-ink-faint">None yet. Press + or say "start a session in" a project.</p>}
        </section>

        {recentlyClosed.length > 0 && (
          <section className="flex flex-col gap-0.5">
            <SectionHeading
              title="Recently closed"
              help={
                <>
                  <span>Sessions that ended, or that were running when Callsign stopped. Bringing one back resumes its conversation where it left off.</span>
                  <span>
                    Say <SayThis>bring back ultron</SayThis> or click it.
                  </span>
                </>
              }
            />
            {recentlyClosed.slice(0, 6).map((closed) => (
              <ClosedRow key={closed.name} name={closed.name} />
            ))}
          </section>
        )}
      </div>

      <SidebarFooter onOpenSetup={onOpenSetup} />
    </aside>
  );
}

function SidebarRail({ onOpenSetup }: { onOpenSetup: () => void }) {
  const { perform } = useCallsign();
  const changeLayout = useCallsignStore((state) => state.changeLayout);
  const focusedSession = useCallsignStore((state) => state.focusedSession);
  const { queue, ordered } = useOrderedSessions();
  const headName = queue[0]?.sessionName;
  return (
    <aside className="flex min-h-0 w-[60px] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-2">
      <RailButton label="Open the sidebar" onClick={() => changeLayout({ sidebarCollapsed: false })}>
        <PanelLeftOpenIcon size={16} />
      </RailButton>
      <div className="my-1 h-px w-6 bg-line" />
      <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto">
        {ordered.map((session) => (
          <button
            key={session.name}
            type="button"
            title={`${session.name}, ${stateDisplay[session.state].label}`}
            aria-label={`${session.name}, ${stateDisplay[session.state].label}`}
            onClick={() => perform({ type: "focus", session: session.name })}
            className={`press cursor-pointer rounded-[9px] p-[3px] transition-colors duration-150 hover:bg-raised ${focusedSession === session.name ? "bg-raised ring-1 ring-line-strong" : ""} ${headName === session.name ? "ring-1 ring-ink/40" : ""}`}
          >
            <SessionAvatar name={session.name} state={session.state} size={32} />
          </button>
        ))}
        <RailButton label="New session" onClick={() => changeLayout({ sidebarCollapsed: false })}>
          <PlusIcon size={16} />
        </RailButton>
      </div>
      <ModeButton compact />
      <RailButton label="Setup" onClick={onOpenSetup}>
        <SettingsIcon size={16} />
      </RailButton>
    </aside>
  );
}

function SessionRow({ session }: { session: SessionView }) {
  const { perform } = useCallsign();
  const focusedSession = useCallsignStore((state) => state.focusedSession);
  const now = useServerNow();
  const display = stateDisplay[session.state];
  const isFocused = focusedSession === session.name;
  const detail = session.pending?.kind === "permission" ? "Wants your OK" : session.lastPrompt;
  return (
    <button
      type="button"
      onClick={() => perform({ type: "focus", session: session.name })}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-inner px-2 py-1.5 text-left transition-colors duration-150 hover:bg-raised ${isFocused ? "bg-raised" : ""}`}
    >
      <SessionAvatar name={session.name} state={session.state} size={30} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-mono text-meta text-ink">{session.name}</span>
          {session.agent !== "claude" && <span className="shrink-0 text-[12px] text-ink-faint">{session.agent}</span>}
          {session.origin === "external" && <span className="shrink-0 text-[12px] text-ink-faint">own terminal</span>}
        </span>
        <span className="flex items-center gap-1.5 text-[12.5px]">
          <span className={display.textClass}>{display.label}</span>
          {isWaitingOnUser(session.state) && <span className="font-mono text-ink-faint tabular-nums">{shortDuration(now - session.stateSince)}</span>}
          {detail && <span className="truncate text-ink-faint">· {detail}</span>}
        </span>
      </span>
    </button>
  );
}

function ClosedRow({ name }: { name: string }) {
  const { perform } = useCallsign();
  return (
    <button type="button" onClick={() => perform({ type: "resume", session: name })} className="group flex cursor-pointer items-center gap-2.5 rounded-inner px-2 py-1.5 text-left transition-colors duration-150 hover:bg-raised">
      <span className="opacity-50 transition-opacity duration-150 group-hover:opacity-100">
        <SessionAvatar name={name} size={24} />
      </span>
      <span className="truncate font-mono text-meta text-ink-muted group-hover:text-ink">{name}</span>
      <BringBackIcon size={14} className="ml-auto text-ink-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
    </button>
  );
}

function NewSessionPicker({ onDone }: { onDone: () => void }) {
  const { perform } = useCallsign();
  const projects = useCallsignStore((state) => state.projects);
  // Selected whole and filtered here: a selector returning a new array each time re-renders forever.
  const agents = useCallsignStore((state) => state.setup?.agents);
  const installedAgents = useMemo(() => (agents ?? []).filter((agent) => agent.version), [agents]);
  const [filter, setFilter] = useState("");
  const [agent, setAgent] = useState<AgentKind>("claude");
  const shown = projects.filter((project) => project.includes(filter.toLowerCase())).slice(0, 10);
  return (
    <Tray className="enter-rise mb-1 flex flex-col gap-1 p-1">
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
              {installed.label.replace(" CLI", "").replace(" Code", "")}
            </button>
          ))}
        </div>
      )}
      <input
        autoFocus
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && onDone()}
        placeholder="Find a project"
        className="h-8 rounded-[4px] border border-line bg-panel px-2.5 text-meta text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
      />
      {shown.map((project) => (
        <button
          key={project}
          type="button"
          onClick={() => {
            perform({ type: "spawn", project, ...(agent === "claude" ? {} : { agent }) });
            onDone();
          }}
          className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1.5 text-left font-mono text-meta text-ink hover:bg-raised"
        >
          <SessionAvatar name={project} size={18} />
          {project}
        </button>
      ))}
      {shown.length === 0 && <p className="px-2.5 py-1.5 text-meta text-ink-faint">No project matches. Add folders in Setup.</p>}
    </Tray>
  );
}

function SidebarFooter({ onOpenSetup }: { onOpenSetup: () => void }) {
  const sessions = useCallsignStore((state) => state.sessions);
  const handsOff = useCallsignStore((state) => state.handsOff);
  const now = useServerNow();
  const waitedToday = sessions.reduce((total, session) => total + session.waitedMillisecondsToday + (isWaitingOnUser(session.state) ? now - session.stateSince : 0), 0);
  const voiceShare = handsOff.voiceShare;
  return (
    <footer className="flex shrink-0 flex-col gap-2 border-t border-line p-3">
      <div className="flex items-center gap-3 px-1 text-[12.5px] text-ink-faint">
        <span title="How long sessions waited for you today">
          Waited <span className="font-mono text-ink-muted tabular-nums">{shortDuration(waitedToday)}</span>
        </span>
        <span title={`${handsOff.voice} by voice, ${handsOff.keyboard} by keyboard, ${handsOff.pointer} by pointer today`}>
          Hands off <span className="font-mono text-ink-muted tabular-nums">{voiceShare === undefined ? "–" : `${Math.round(voiceShare * 100)}%`}</span>
        </span>
        <HelpTip title="Today's numbers">
          <span>Waited: how long your sessions sat waiting for you today, added up.</span>
          <span>Hands off: how much of what you did today was by voice rather than keyboard or mouse.</span>
        </HelpTip>
      </div>
      <div className="flex gap-1">
        <ModeButton />
        <button
          type="button"
          onClick={onOpenSetup}
          className="press key-lift flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-inner border border-line bg-key text-meta text-ink shadow-key hover:bg-key-hover"
        >
          <SettingsIcon size={15} />
          {isPlayground ? "Install" : "Setup"}
        </button>
      </div>
    </footer>
  );
}

function ModeButton({ compact = false }: { compact?: boolean }) {
  const { perform } = useCallsign();
  const mode = useCallsignStore((state) => state.control.mode);
  const ModeIcon = mode === "speak" ? SpeakerIcon : mode === "quiet" ? SpeakerQuietIcon : SpeakerMutedIcon;
  const title = "Speaking says everything, Quiet only permissions and questions, Muted plays sounds only. Or say: be quiet, mute, talk to me.";
  if (compact) {
    return (
      <RailButton label={`${modeLabel[mode]}. ${title}`} onClick={() => perform({ type: "mode", mode: nextMode[mode] })}>
        <ModeIcon size={16} />
      </RailButton>
    );
  }
  return (
    <button
      type="button"
      title={title}
      onClick={() => perform({ type: "mode", mode: nextMode[mode] })}
      className="press key-lift flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-inner border border-line bg-key text-meta text-ink shadow-key hover:bg-key-hover"
    >
      <ModeIcon size={15} />
      {modeLabel[mode]}
    </button>
  );
}

function SectionHeading({ title, help, action }: { title: string; help: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-1 pb-1">
      <h2 className="px-1 text-meta font-medium text-ink-muted">{title}</h2>
      <HelpTip title={title}>{help}</HelpTip>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

function RailButton({ label, onClick, children, className = "" }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`press flex size-8 cursor-pointer items-center justify-center rounded-inner text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink ${className}`}>
      {children}
    </button>
  );
}

function ConnectionMark() {
  const status = useCallsignStore((state) => state.connectionStatus);
  if (status === "open") return null;
  const text = status === "needs_token" ? "Open it with the callsign command" : status === "connecting" ? "Connecting" : "Reconnecting";
  return <span className="truncate rounded-mark bg-permission/15 px-1.5 py-0.5 text-[12px] text-permission">{text}</span>;
}

function attentionRank(queue: ReturnType<typeof AttentionQueue.build>, session: SessionView): number {
  const index = queue.findIndex((item) => item.sessionName === session.name);
  return index === -1 ? queue.length + (session.state === "working" ? 0 : 1) : index;
}
