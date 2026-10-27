// The left side: what needs you first, every session, starting and bringing sessions back, and the
// controls that used to sit in a top bar. Folds to a rail of session faces.

import { useMemo, useState } from "react";
import { AttentionQueue } from "../../shared/attention.ts";
import { useHeyTerm } from "../app-context.tsx";
import { isPlayground } from "../playground/is-playground.ts";
import { useHeyTermStore } from "../state/heyterm-store.ts";
import { useServerNow } from "../state/use-server-now.ts";
import { HelpTip, SayThis } from "../ui/HelpTip.tsx";
import { RailLabel } from "../ui/RailLabel.tsx";
import { BringBackIcon, CloseIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PencilIcon, PlusIcon, SettingsIcon, SpeakerIcon, SpeakerMutedIcon, SpeakerQuietIcon } from "../ui/icons.tsx";
import { avatarRadius, SessionAvatar } from "../ui/SessionAvatar.tsx";
import { NewSessionPicker } from "./NewSessionPicker.tsx";
import { RenameField, RowActionButton, RowActions, SessionDetailsCard } from "./SessionDetails.tsx";
import { SessionIdentity } from "./session-identity.ts";
import { agentTag, displayFor, isWaitingOnUser, shortDuration } from "./session-display.ts";
import type { ClosedSessionView } from "../../shared/protocol.ts";
import type { AnnouncementMode, SessionView } from "../../shared/types.ts";

const nextMode: Record<AnnouncementMode, AnnouncementMode> = { speak: "quiet", quiet: "mute", mute: "speak" };
const modeLabel: Record<AnnouncementMode, string> = { speak: "Speaking", quiet: "Quiet", mute: "Muted" };

export function Sidebar({ onOpenSetup }: { onOpenSetup: () => void }) {
  const collapsed = useHeyTermStore((state) => state.layout.sidebarCollapsed);
  if (!collapsed) return <SidebarPanel onOpenSetup={onOpenSetup} />;
  // The rail is for wide screens. On a phone the sidebar stacks above the terminals and never folds.
  return (
    <>
      <SidebarRail onOpenSetup={onOpenSetup} className="hidden md:flex" />
      <SidebarPanel onOpenSetup={onOpenSetup} className="flex md:hidden" />
    </>
  );
}

function useOrderedSessions() {
  const sessions = useHeyTermStore((state) => state.sessions);
  return useMemo(() => {
    const queue = AttentionQueue.build(sessions);
    const ordered = [...sessions].sort((left, right) => attentionRank(queue, left) - attentionRank(queue, right) || left.createdAt - right.createdAt);
    return { queue, ordered };
  }, [sessions]);
}

function SidebarPanel({ onOpenSetup, className = "flex" }: { onOpenSetup: () => void; className?: string }) {
  const sessions = useHeyTermStore((state) => state.sessions);
  const recentlyClosed = useHeyTermStore((state) => state.recentlyClosed);
  const changeLayout = useHeyTermStore((state) => state.changeLayout);
  const { ordered } = useOrderedSessions();
  const [isPickerOpen, setPickerOpen] = useState(false);

  return (
    <aside className={`${className} max-h-[45vh] min-h-0 w-full shrink-0 flex-col border-b border-line bg-panel md:my-2 md:ml-2 md:max-h-none md:w-[280px] md:overflow-hidden md:rounded-outer md:border`}>
      <header className="flex h-12 shrink-0 items-center gap-2 px-3">
        <img src="/favicon.svg" alt="" width={22} height={22} className="shrink-0" />
        <span className="text-meta font-semibold tracking-tight text-ink">HeyTerm</span>
        <ConnectionMark />
        {isPlayground && <span className="rounded-mark border border-line px-1.5 text-small text-ink-muted">Playground</span>}
        <RailButton label="Fold the sidebar" onClick={() => changeLayout({ sidebarCollapsed: true })} className="ml-auto hidden md:flex">
          <PanelLeftCloseIcon size={16} />
        </RailButton>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-3 pb-3">
        <section className="flex flex-col gap-0.5">
          <SectionHeading
            title="Sessions"
            help={
              <>
                <span>Every coding agent running in HeyTerm, and Claude sessions from your own terminals if Setup shows them. The ones that need you come first.</span>
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
                  <span>Sessions that ended, or that were running when HeyTerm stopped. Bringing one back resumes its conversation where it left off.</span>
                  <span>
                    Say <SayThis>bring back ultron</SayThis> or click it.
                  </span>
                </>
              }
            />
            {recentlyClosed.slice(0, 6).map((closed) => (
              <ClosedRow key={closed.name} closed={closed} />
            ))}
          </section>
        )}
      </div>

      <SidebarFooter onOpenSetup={onOpenSetup} />
    </aside>
  );
}

function SidebarRail({ onOpenSetup, className }: { onOpenSetup: () => void; className: string }) {
  const changeLayout = useHeyTermStore((state) => state.changeLayout);
  const recentlyClosed = useHeyTermStore((state) => state.recentlyClosed);
  const { queue, ordered } = useOrderedSessions();
  const headName = queue[0]?.sessionName;
  return (
    <aside className={`${className} min-h-0 w-[60px] shrink-0 flex-col items-center overflow-hidden rounded-outer border border-line bg-panel md:my-2 md:ml-2`}>
      <header className="flex h-12 shrink-0 items-center">
        <img src="/favicon.svg" alt="HeyTerm" width={24} height={24} />
      </header>
      <LabeledRailButton label="Open the sidebar" onClick={() => changeLayout({ sidebarCollapsed: false })}>
        <PanelLeftOpenIcon size={16} />
      </LabeledRailButton>
      <div className="my-2 h-px w-6 shrink-0 bg-line" />
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto pb-2">
        {ordered.map((session) => (
          <RailSession key={session.name} session={session} isHead={headName === session.name} />
        ))}
        <LabeledRailButton label="New session" onClick={() => changeLayout({ sidebarCollapsed: false })}>
          <PlusIcon size={16} />
        </LabeledRailButton>
        {recentlyClosed.length > 0 && <div className="my-1 h-px w-6 shrink-0 bg-line" />}
        {recentlyClosed.slice(0, 6).map((closed) => (
          <RailClosedSession key={closed.name} name={closed.name} />
        ))}
      </div>
      <footer className="flex w-full shrink-0 flex-col items-center gap-1 border-t border-line py-2">
        <ModeButton compact />
        <LabeledRailButton label={isPlayground ? "Install" : "Setup"} onClick={onOpenSetup}>
          <SettingsIcon size={16} />
        </LabeledRailButton>
      </footer>
    </aside>
  );
}

// A face in the folded sidebar. Waiting sessions keep their time under the face, as the open sidebar shows it.
function RailSession({ session, isHead }: { session: SessionView; isHead: boolean }) {
  const { perform } = useHeyTerm();
  const focusedSession = useHeyTermStore((state) => state.focusedSession);
  const now = useServerNow();
  const display = displayFor(session);
  const isWaiting = isWaitingOnUser(session.state);
  const waitedFor = isWaiting ? shortDuration(now - session.stateSince) : "";
  const detail = isWaiting ? "" : SessionIdentity.promptPreview(session.lastPrompt ?? "");
  const label = (
    <>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-ink">{session.name}</span>
        {agentTag(session.agent) && <span className="text-small text-ink-faint">{agentTag(session.agent)}</span>}
        {session.origin === "external" && <span className="text-small text-ink-faint">own terminal</span>}
      </span>
      <span className="flex items-center gap-1.5 text-small">
        <span className={display.textClass}>{display.label}</span>
        {waitedFor && <span className="font-mono text-ink-faint tabular-nums">{waitedFor}</span>}
      </span>
      {detail && <span className="truncate text-small text-ink-faint">{detail}</span>}
    </>
  );
  return (
    <RailLabel label={label}>
      <button
        type="button"
        aria-label={`${session.name}, ${display.label}`}
        onClick={() => perform({ type: "focus", session: session.name })}
        style={{ borderRadius: avatarRadius(32) + 3 }}
        className={`press flex cursor-pointer flex-col items-center gap-0.5 p-[3px] transition-colors duration-150 hover:bg-raised ${focusedSession === session.name ? "bg-raised ring-1 ring-line-strong" : ""} ${isHead ? "ring-1 ring-ink/40" : ""}`}
      >
        <SessionAvatar name={session.name} state={session.state} size={32} />
        {waitedFor && <span className={`font-mono text-micro tabular-nums ${display.textClass}`}>{waitedFor}</span>}
      </button>
    </RailLabel>
  );
}

function RailClosedSession({ name }: { name: string }) {
  const { perform } = useHeyTerm();
  return (
    <RailLabel
      label={
        <span className="flex items-center gap-1.5">
          <BringBackIcon size={13} className="text-ink-faint" />
          Bring back <span className="font-mono">{name}</span>
        </span>
      }
    >
      <button
        type="button"
        aria-label={`Bring back ${name}`}
        onClick={() => perform({ type: "resume", session: name })}
        style={{ borderRadius: avatarRadius(26) + 3 }}
        className="press cursor-pointer p-[3px] opacity-50 transition-[opacity,background-color] duration-150 hover:bg-raised hover:opacity-100"
      >
        <SessionAvatar name={name} size={26} />
      </button>
    </RailLabel>
  );
}

function SessionRow({ session }: { session: SessionView }) {
  const { perform } = useHeyTerm();
  const focusedSession = useHeyTermStore((state) => state.focusedSession);
  const takenNames = useTakenNames();
  const now = useServerNow();
  const [isRenaming, setRenaming] = useState(false);
  const display = displayFor(session);
  const isFocused = focusedSession === session.name;
  // The state already says what a waiting session needs; otherwise show what it was last asked.
  const detail = isWaitingOnUser(session.state) ? "" : SessionIdentity.promptPreview(session.lastPrompt ?? "");
  if (isRenaming) {
    return (
      <div className="flex items-start gap-2.5 rounded-inner bg-raised px-2 py-1.5">
        <SessionAvatar name={session.name} state={session.state} size={30} />
        <RenameField currentName={session.name} takenNames={takenNames} onDone={() => setRenaming(false)} />
      </div>
    );
  }
  return (
    <div className="group relative">
      <RailLabel className="flex" label={<SessionDetailsCard name={session.name} facts={session} hint="Click to show it." />}>
        <button
          type="button"
          onClick={() => perform({ type: "focus", session: session.name })}
          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-inner px-2 py-1.5 text-left transition-colors duration-150 hover:bg-raised ${isFocused ? "bg-raised" : ""}`}
        >
          <SessionAvatar name={session.name} state={session.state} size={30} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-mono text-meta text-ink">{session.name}</span>
              {agentTag(session.agent) && <span className="shrink-0 text-small text-ink-faint">{agentTag(session.agent)}</span>}
              {session.origin === "external" && <span className="shrink-0 text-small text-ink-faint">own terminal</span>}
            </span>
            <span className="flex items-center gap-1.5 text-small">
              <span className={display.textClass}>{display.label}</span>
              {isWaitingOnUser(session.state) && <span className="font-mono text-ink-faint tabular-nums">{shortDuration(now - session.stateSince)}</span>}
              {detail && <span className="truncate text-ink-faint">· {detail}</span>}
            </span>
          </span>
        </button>
      </RailLabel>
      <RowActions>
        <RowActionButton label={`Rename ${session.name}`} onClick={() => setRenaming(true)}>
          <PencilIcon size={13} />
        </RowActionButton>
      </RowActions>
    </div>
  );
}

function ClosedRow({ closed }: { closed: ClosedSessionView }) {
  const { perform } = useHeyTerm();
  const takenNames = useTakenNames();
  const [isRenaming, setRenaming] = useState(false);
  if (isRenaming) {
    return (
      <div className="flex items-start gap-2.5 rounded-inner bg-raised px-2 py-1.5">
        <SessionAvatar name={closed.name} size={24} />
        <RenameField currentName={closed.name} takenNames={takenNames} onDone={() => setRenaming(false)} />
      </div>
    );
  }
  return (
    <div className="group relative">
      <RailLabel className="flex" label={<SessionDetailsCard name={closed.name} facts={closed} hint="Click to bring it back where it left off." />}>
        <button type="button" onClick={() => perform({ type: "resume", session: closed.name })} className="flex w-full cursor-pointer items-center gap-2.5 rounded-inner px-2 py-1.5 text-left transition-colors duration-150 hover:bg-raised">
          <span className="opacity-50 transition-opacity duration-150 group-hover:opacity-100">
            <SessionAvatar name={closed.name} size={24} />
          </span>
          <span className="truncate font-mono text-meta text-ink-muted group-hover:text-ink">{closed.name}</span>
        </button>
      </RailLabel>
      <RowActions>
        <RowActionButton label={`Rename ${closed.name}`} onClick={() => setRenaming(true)}>
          <PencilIcon size={13} />
        </RowActionButton>
        <RowActionButton label={`Remove ${closed.name} from the list`} onClick={() => perform({ type: "forget_closed", session: closed.name })}>
          <CloseIcon size={13} />
        </RowActionButton>
      </RowActions>
    </div>
  );
}

// Every name an open or closed session has, which a rename cannot take.
function useTakenNames(): string[] {
  const sessions = useHeyTermStore((state) => state.sessions);
  const recentlyClosed = useHeyTermStore((state) => state.recentlyClosed);
  return useMemo(() => [...sessions.map((session) => session.name), ...recentlyClosed.map((closed) => closed.name)], [sessions, recentlyClosed]);
}

function SidebarFooter({ onOpenSetup }: { onOpenSetup: () => void }) {
  const sessions = useHeyTermStore((state) => state.sessions);
  const handsOff = useHeyTermStore((state) => state.handsOff);
  const now = useServerNow();
  const waitedToday = sessions.reduce((total, session) => total + session.waitedMillisecondsToday + (isWaitingOnUser(session.state) ? now - session.stateSince : 0), 0);
  const voiceShare = handsOff.voiceShare;
  return (
    <footer className="flex shrink-0 flex-col gap-2 border-t border-line p-3">
      <div className="flex items-center gap-3 px-1 text-small text-ink-faint">
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
  const { perform } = useHeyTerm();
  const mode = useHeyTermStore((state) => state.control.mode);
  const ModeIcon = mode === "speak" ? SpeakerIcon : mode === "quiet" ? SpeakerQuietIcon : SpeakerMutedIcon;
  const title = "Speaking says everything, Quiet only permissions and questions, Muted plays sounds only. Or say: be quiet, mute, talk to me.";
  if (compact) {
    return (
      <LabeledRailButton label={`${modeLabel[mode]}. Click to change, or say "be quiet", "mute" or "talk to me".`} onClick={() => perform({ type: "mode", mode: nextMode[mode] })}>
        <ModeIcon size={16} />
      </LabeledRailButton>
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

// An icon button in the folded sidebar, named beside it on hover instead of with the browser's slow tooltip.
function LabeledRailButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <RailLabel label={label}>
      <RailButton label={label} onClick={onClick} showsTitle={false}>
        {children}
      </RailButton>
    </RailLabel>
  );
}

function RailButton({ label, onClick, children, className = "", showsTitle = true }: { label: string; onClick: () => void; children: React.ReactNode; className?: string; showsTitle?: boolean }) {
  return (
    <button type="button" aria-label={label} title={showsTitle ? label : undefined} onClick={onClick} className={`press flex size-8 cursor-pointer items-center justify-center rounded-inner text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink ${className}`}>
      {children}
    </button>
  );
}

function ConnectionMark() {
  const status = useHeyTermStore((state) => state.connectionStatus);
  if (status === "open") return null;
  const text = status === "needs_token" ? "Open it with the heyterm command" : status === "connecting" ? "Connecting" : "Reconnecting";
  return <span className="truncate rounded-mark bg-permission/15 px-1.5 py-0.5 text-small text-permission">{text}</span>;
}

function attentionRank(queue: ReturnType<typeof AttentionQueue.build>, session: SessionView): number {
  const index = queue.findIndex((item) => item.sessionName === session.name);
  return index === -1 ? queue.length + (session.state === "working" ? 0 : 1) : index;
}
