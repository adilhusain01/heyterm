// A request from a session, where you can act on it: docked above the bar you talk into, and as a
// slim banner on the asking session's own pane. Says what it wants, what to say, and offers buttons.

import { useHeyTerm } from "../app-context.tsx";
import { useServerNow } from "../state/use-server-now.ts";
import { FoldedText } from "../ui/FoldedText.tsx";
import { Key } from "../ui/Key.tsx";
import { SessionAvatar } from "../ui/SessionAvatar.tsx";
import { shortDuration } from "./session-display.ts";
import type { AttentionItem, PendingPermission, PendingQuestion, SessionView } from "../../shared/types.ts";

// The kinds that wait on a decision. Finished work is announced and badged, not docked.
export const decisionKinds: AttentionItem["kind"][] = ["permission", "question", "trust", "failed"];

export function RequestCard({ item, session, variant }: { item: AttentionItem; session: SessionView; variant: "dock" | "banner" }) {
  const now = useServerNow();
  const isDock = variant === "dock";
  return (
    <section
      key={`${item.sessionName}-${item.kind}-${item.since}`}
      aria-live="polite"
      className={`enter-rise flex gap-3 ${isDock ? "rounded-outer border border-line-strong bg-raised p-3 shadow-key" : "border-b border-line bg-raised px-3 py-2.5"}`}
    >
      {isDock && <SessionAvatar name={session.name} state={session.state} size={32} />}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex items-baseline gap-2 text-meta">
          {isDock && <span className="font-mono text-ink">{session.name}</span>}
          <span className="text-ink">{whatItWants(item, session)}</span>
          {isDock && <span className="ml-auto shrink-0 font-mono text-[12.5px] text-ink-faint tabular-nums">{shortDuration(now - item.since)}</span>}
        </p>
        <RequestDetail item={item} session={session} folded={!isDock} />
      </div>
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

function RequestDetail({ item, session, folded }: { item: AttentionItem; session: SessionView; folded: boolean }) {
  const pending = session.pending;
  if (item.kind === "permission" && pending?.kind === "permission") return <PermissionActions sessionName={session.name} pending={pending} showDetail={!folded} />;
  if (item.kind === "question" && pending?.kind === "question") return <QuestionActions sessionName={session.name} pending={pending} />;
  if (item.kind === "trust") return <TrustActions session={session} showDetail={!folded} />;
  return <OpenAction session={session} />;
}

function PermissionActions({ sessionName, pending, showDetail }: { sessionName: string; pending: PendingPermission; showDetail: boolean }) {
  const { perform } = useHeyTerm();
  return (
    <>
      {showDetail && <FoldedText text={pending.summary} lines={2} />}
      <ActionRow hint={'Say "approve", or "no" and why'}>
        <Key tone="primary" size="small" onClick={() => perform({ type: "approve", session: sessionName, requestId: pending.requestId, confirmed: true })}>
          Approve
        </Key>
        <Key size="small" onClick={() => perform({ type: "deny", session: sessionName, requestId: pending.requestId })}>
          Deny
        </Key>
      </ActionRow>
    </>
  );
}

function QuestionActions({ sessionName, pending }: { sessionName: string; pending: PendingQuestion }) {
  const { perform } = useHeyTerm();
  const [question] = pending.questions;
  if (!question) return null;
  const answer = (label: string) => perform({ type: "answer", session: sessionName, requestId: pending.requestId, answers: { [question.question]: label } });
  return (
    <ActionRow hint="Say an option, its number, or answer in your own words">
      {question.options.map((option, index) => (
        <Key key={option.label} size="small" title={option.description} onClick={() => answer(option.label)}>
          <span className="font-mono text-ink-faint">{index + 1}</span>
          {option.label}
        </Key>
      ))}
    </ActionRow>
  );
}

function TrustActions({ session, showDetail }: { session: SessionView; showDetail: boolean }) {
  const { perform } = useHeyTerm();
  return (
    <>
      {showDetail && session.trustSubject !== "hooks" && <FoldedText text={session.projectPath} lines={1} />}
      <ActionRow hint={'Say "trust it"'}>
        <Key tone="primary" size="small" onClick={() => perform({ type: "trust", session: session.name })}>
          Trust
        </Key>
      </ActionRow>
    </>
  );
}

function OpenAction({ session }: { session: SessionView }) {
  const { perform } = useHeyTerm();
  return (
    <ActionRow hint={`Say "go to ${session.name}"`}>
      <Key size="small" onClick={() => perform({ type: "focus", session: session.name })}>
        Open
      </Key>
    </ActionRow>
  );
}

function ActionRow({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {children}
      <span className="ml-1 text-[12.5px] text-ink-faint">{hint}</span>
    </div>
  );
}
