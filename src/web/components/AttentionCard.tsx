// A request from a session, where you can act on it. Two places, one set of parts, and only ever
// one of them on screen, so a request has a single place to answer it:
// - "chat": a message in the conversation, in the order it arrived; settles once answered.
// - "bar": one slim row above the bar you talk into, while the conversation is folded away.

import { useHeyTerm } from "../app-context.tsx";
import { useServerNow } from "../state/use-server-now.ts";
import { FoldedText } from "../ui/FoldedText.tsx";
import { CheckIcon } from "../ui/icons.tsx";
import { Key } from "../ui/Key.tsx";
import { SessionAvatar } from "../ui/SessionAvatar.tsx";
import { PathDisplay } from "./path-display.ts";
import { shortDuration, stateDisplay } from "./session-display.ts";
import type { AttentionItem, PendingPermission, PendingQuestion, SessionView } from "../../shared/types.ts";

type RequestVariant = "chat" | "bar";

export function RequestCard({ item, session, variant }: { item: AttentionItem; session: SessionView; variant: RequestVariant }) {
  if (variant === "bar") return <BarRequest item={item} session={session} />;
  return <ChatRequest item={item} session={session} />;
}

function ChatRequest({ item, session }: { item: AttentionItem; session: SessionView }) {
  const now = useServerNow();
  const display = stateDisplay[session.state];
  return (
    <section aria-live="polite" aria-label={`${session.name}: ${whatItWants(item, session)}`} className="flex flex-col gap-2.5 rounded-outer border border-line-strong bg-canvas p-3">
      <header className="flex items-center gap-2 text-meta">
        <SessionAvatar name={session.name} state={session.state} size={22} />
        <span className="font-mono text-ink">{session.name}</span>
        <span className={display.textClass}>{display.label}</span>
        <span className="ml-auto font-mono text-small text-ink-faint tabular-nums">{shortDuration(now - item.since)}</span>
      </header>
      <p className="text-body text-ink">{whatItWants(item, session)}</p>
      <RequestActions item={item} session={session} showDetail />
    </section>
  );
}

// A request that was answered, kept in the conversation as a quiet line so the thread still reads.
export function SettledRequest({ text, sessionName }: { text: string; sessionName: string }) {
  return (
    <p className="flex items-center gap-2 text-meta text-ink-muted">
      <span className="opacity-60">
        <SessionAvatar name={sessionName} size={18} />
      </span>
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <span className="flex shrink-0 items-center gap-1 text-small text-ink-faint">
        <CheckIcon size={13} />
        Answered
      </span>
    </p>
  );
}

function BarRequest({ item, session }: { item: AttentionItem; session: SessionView }) {
  const detail = barDetail(item, session);
  return (
    <section aria-live="polite" className="flex min-h-11 items-center gap-2.5 py-1.5 pr-1.5 pl-2.5">
      <SessionAvatar name={session.name} state={session.state} size={24} />
      <p className="flex min-w-0 flex-1 items-baseline gap-2 text-meta">
        <span className="shrink-0 font-mono text-ink">{session.name}</span>
        <span className="shrink-0 text-ink">{whatItWants(item, session)}</span>
        {detail && <span className="truncate font-mono text-small text-ink-faint">{detail}</span>}
      </p>
      <RequestKeys item={item} session={session} />
    </section>
  );
}

function whatItWants(item: AttentionItem, session: SessionView): string {
  const pending = session.pending;
  if (item.kind === "permission" && pending?.kind === "permission") {
    const action = pending.toolName === "Bash" ? "Wants to run a command" : pending.summary.startsWith("edit ") ? "Wants to edit a file" : "Wants to use a tool";
    return pending.risk === "high" ? `${action}. It ${pending.riskReasons.join(" and ")}.` : action;
  }
  if (item.kind === "question" && pending?.kind === "question") return pending.questions[0]?.question ?? "Has a question";
  if (item.kind === "trust") return session.trustSubject === "hooks" ? "Asks you to trust HeyTerm's hooks" : "Asks whether you trust this folder";
  if (item.kind === "failed") return "Stopped on an error";
  return item.headline.replace(`${session.name} `, "");
}

// The one line of detail the slim row has room for: the command, or the folder.
function barDetail(item: AttentionItem, session: SessionView): string | undefined {
  const pending = session.pending;
  if (item.kind === "permission" && pending?.kind === "permission") return pending.summary.split("\n")[0];
  if (item.kind === "trust" && session.trustSubject !== "hooks") return PathDisplay.tail(session.projectPath);
  return undefined;
}

function RequestActions({ item, session, showDetail }: { item: AttentionItem; session: SessionView; showDetail: boolean }) {
  const pending = session.pending;
  return (
    <>
      {showDetail && item.kind === "permission" && pending?.kind === "permission" && <FoldedText text={pending.summary} lines={3} />}
      {showDetail && item.kind === "trust" && session.trustSubject !== "hooks" && (
        <p className="truncate rounded-inner border border-line bg-tray px-2.5 py-2 font-mono text-small text-ink shadow-tray" title={session.projectPath}>
          {PathDisplay.tail(session.projectPath)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <RequestKeys item={item} session={session} />
        <span className="ml-1 text-small text-ink-faint">{spokenHint(item, session)}</span>
      </div>
    </>
  );
}

function spokenHint(item: AttentionItem, session: SessionView): string {
  if (item.kind === "permission") return 'Or say "approve", or "no" and why';
  if (item.kind === "question") return "Or say an option, its number, or your own words";
  if (item.kind === "trust") return 'Or say "trust it"';
  return `Or say "go to ${session.name}"`;
}

function RequestKeys({ item, session }: { item: AttentionItem; session: SessionView }) {
  const pending = session.pending;
  if (item.kind === "permission" && pending?.kind === "permission") return <PermissionKeys sessionName={session.name} pending={pending} />;
  if (item.kind === "question" && pending?.kind === "question") return <QuestionKeys sessionName={session.name} pending={pending} />;
  if (item.kind === "trust") return <TrustKey sessionName={session.name} />;
  return <OpenKey sessionName={session.name} />;
}

function PermissionKeys({ sessionName, pending }: { sessionName: string; pending: PendingPermission }) {
  const { perform } = useHeyTerm();
  return (
    <span className="flex shrink-0 gap-1.5">
      <Key tone="primary" size="small" onClick={() => perform({ type: "approve", session: sessionName, requestId: pending.requestId, confirmed: true })}>
        Approve
      </Key>
      <Key size="small" onClick={() => perform({ type: "deny", session: sessionName, requestId: pending.requestId })}>
        Deny
      </Key>
    </span>
  );
}

function QuestionKeys({ sessionName, pending }: { sessionName: string; pending: PendingQuestion }) {
  const { perform } = useHeyTerm();
  const [question] = pending.questions;
  if (!question) return null;
  const answer = (label: string) => perform({ type: "answer", session: sessionName, requestId: pending.requestId, answers: { [question.question]: label } });
  return (
    <span className="flex flex-wrap gap-1.5">
      {question.options.map((option, index) => (
        <Key key={option.label} size="small" title={option.description} onClick={() => answer(option.label)}>
          <span className="font-mono text-ink-faint">{index + 1}</span>
          {option.label}
        </Key>
      ))}
    </span>
  );
}

function TrustKey({ sessionName }: { sessionName: string }) {
  const { perform } = useHeyTerm();
  return (
    <Key tone="primary" size="small" className="shrink-0" onClick={() => perform({ type: "trust", session: sessionName })}>
      Trust
    </Key>
  );
}

function OpenKey({ sessionName }: { sessionName: string }) {
  const { perform } = useHeyTerm();
  return (
    <Key size="small" className="shrink-0" onClick={() => perform({ type: "focus", session: sessionName })}>
      Open
    </Key>
  );
}
