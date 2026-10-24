// The one thing that needs you most, with what to say and buttons for when you would rather click.

import { useCallsign } from "../app-context.tsx";
import { useServerNow } from "../state/use-server-now.ts";
import { FoldedText } from "../ui/FoldedText.tsx";
import { Hint } from "../ui/Hint.tsx";
import { Key } from "../ui/Key.tsx";
import { StateMark } from "../ui/StateMark.tsx";
import { messageVoiceHint, shortDuration } from "./session-display.ts";
import type { AttentionItem, PendingPermission, PendingQuestion, SessionView } from "../../shared/types.ts";

export function AttentionCard({ item, session, moreWaiting }: { item: AttentionItem; session: SessionView; moreWaiting: number }) {
  const now = useServerNow();
  return (
    <section key={`${item.sessionName}-${item.kind}-${item.since}`} className="enter-rise rounded-outer border border-line bg-raised p-1" aria-live="polite">
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 text-meta text-ink-muted">
        <StateMark state={session.state} />
        <span className="font-mono text-ink">{item.sessionName}</span>
        <span className="tabular-nums">waiting {shortDuration(now - item.since)}</span>
        {moreWaiting > 0 && <span className="ml-auto">{moreWaiting} more</span>}
      </div>
      <CardBody item={item} session={session} />
    </section>
  );
}

function CardBody({ item, session }: { item: AttentionItem; session: SessionView }) {
  const pending = session.pending;
  if (item.kind === "permission" && pending?.kind === "permission") return <PermissionBody sessionName={session.name} pending={pending} />;
  if (item.kind === "question" && pending?.kind === "question") return <QuestionBody sessionName={session.name} pending={pending} />;
  if (item.kind === "trust") return <TrustBody session={session} />;
  return <MessageBody item={item} session={session} />;
}

function PermissionBody({ sessionName, pending }: { sessionName: string; pending: PendingPermission }) {
  const { perform } = useCallsign();
  const isHighRisk = pending.risk === "high";
  return (
    <div className="flex flex-col gap-2 px-3 pb-2.5">
      <p className="text-body text-ink">{pending.toolName === "Bash" ? "Wants to run a command" : `Wants to ${pending.summary.startsWith("edit ") ? "edit a file" : "use a tool"}`}</p>
      <FoldedText text={pending.summary} />
      {isHighRisk && <p className="text-meta text-ink-muted">It {pending.riskReasons.join(" and ")}.</p>}
      <Hint>Say "approve", or "no" and why</Hint>
      <div className="flex gap-1">
        <Key tone="primary" className="flex-1" onClick={() => perform({ type: "approve", session: sessionName, requestId: pending.requestId, confirmed: true })}>
          Approve
        </Key>
        <Key className="flex-1" onClick={() => perform({ type: "deny", session: sessionName, requestId: pending.requestId })}>
          Deny
        </Key>
      </div>
    </div>
  );
}

function QuestionBody({ sessionName, pending }: { sessionName: string; pending: PendingQuestion }) {
  const { perform } = useCallsign();
  const [question] = pending.questions;
  if (!question) return null;
  const answer = (label: string) => perform({ type: "answer", session: sessionName, requestId: pending.requestId, answers: { [question.question]: label } });
  return (
    <div className="flex flex-col gap-2 px-3 pb-2.5">
      <p className="text-body text-ink">{question.question}</p>
      <div className="flex flex-col gap-1">
        {question.options.map((option, index) => (
          <button
            key={option.label}
            type="button"
            onClick={() => answer(option.label)}
            className="press key-lift flex cursor-pointer items-baseline gap-2.5 rounded-inner border border-line bg-key px-3 py-2 text-left shadow-key hover:bg-key-hover"
          >
            <span className="font-mono text-meta text-ink-faint">{index + 1}</span>
            <span className="flex min-w-0 flex-col">
              <span className="text-meta font-medium text-ink">{option.label}</span>
              {option.description && option.description !== option.label && <span className="text-meta text-ink-muted">{option.description}</span>}
            </span>
          </button>
        ))}
      </div>
      <Hint>Say an option, its number, or answer in your own words</Hint>
    </div>
  );
}

function TrustBody({ session }: { session: SessionView }) {
  const { perform } = useCallsign();
  return (
    <div className="flex flex-col gap-2 px-3 pb-2.5">
      <p className="text-body text-ink">Claude has not seen this folder before and asks whether you trust it</p>
      <FoldedText text={session.projectPath} lines={2} />
      <Hint>Say "trust it"</Hint>
      <Key tone="primary" onClick={() => perform({ type: "trust", session: session.name })}>
        Trust folder
      </Key>
    </div>
  );
}

function MessageBody({ item, session }: { item: AttentionItem; session: SessionView }) {
  const { perform } = useCallsign();
  const headline = item.headline.replace(`${session.name} `, "");
  return (
    <div className="flex flex-col gap-2 px-3 pb-2.5">
      <p className="line-clamp-4 text-body text-ink">{headline.charAt(0).toUpperCase() + headline.slice(1)}</p>
      <Hint>{messageVoiceHint(session, item.kind)}</Hint>
      <Key onClick={() => perform({ type: "focus", session: session.name })}>Open</Key>
    </div>
  );
}
