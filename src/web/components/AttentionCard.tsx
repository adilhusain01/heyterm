// The one thing that needs you most, with what to say and buttons for when you would rather click.

import { useCallsign } from "../app-context.tsx";
import { useServerNow } from "../state/use-server-now.ts";
import { shortDuration } from "./session-display.ts";
import type { AttentionItem, PendingPermission, PendingQuestion, SessionView } from "../../shared/types.ts";

const kindAccent: Record<AttentionItem["kind"], string> = {
  permission: "border-permission/60",
  question: "border-question/60",
  trust: "border-trust/60",
  failed: "border-failed/60",
  finished: "border-finished/50",
};

export function AttentionCard({ item, session, moreWaiting }: { item: AttentionItem; session: SessionView; moreWaiting: number }) {
  const now = useServerNow();
  return (
    <section key={`${item.sessionName}-${item.kind}-${item.since}`} className={`enter-rise rounded-outer border bg-raised p-1 ${kindAccent[item.kind]}`} aria-live="polite">
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-2 text-[12px] text-ink-muted">
          <span className="font-mono text-ink">{item.sessionName}</span>
          <span>waiting {shortDuration(now - item.since)}</span>
          {moreWaiting > 0 && <span className="ml-auto">{moreWaiting} more</span>}
        </div>
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
      <p className="text-[13px] text-ink">Wants to {pending.toolName === "Bash" ? "run" : "use"}:</p>
      <pre className="overflow-x-auto rounded-inner border border-line bg-canvas px-2.5 py-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink">{pending.summary}</pre>
      {isHighRisk && <p className="text-[12px] text-permission">This {pending.riskReasons.join(" and ")}.</p>}
      <VoiceHint text={isHighRisk ? "Say confirm, or no and why" : "Say approve, or no and why"} />
      <div className="flex gap-1">
        <ActionButton tone="primary" onClick={() => perform({ type: "approve", session: sessionName, requestId: pending.requestId, confirmed: true })}>
          {isHighRisk ? "Confirm" : "Approve"}
        </ActionButton>
        <ActionButton onClick={() => perform({ type: "deny", session: sessionName, requestId: pending.requestId })}>Deny</ActionButton>
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
      <p className="text-[13px] leading-snug text-ink">{question.question}</p>
      <div className="flex flex-col gap-1">
        {question.options.map((option, index) => (
          <button
            key={option.label}
            type="button"
            onClick={() => answer(option.label)}
            className="press flex cursor-pointer items-baseline gap-2 rounded-inner border border-line bg-panel px-2.5 py-2 text-left shadow-press hover:border-line-strong"
          >
            <span className="font-mono text-[11px] text-ink-faint">{index + 1}</span>
            <span className="text-[13px] text-ink">{option.label}</span>
            {option.description && option.description !== option.label && <span className="truncate text-[12px] text-ink-muted">{option.description}</span>}
          </button>
        ))}
      </div>
      <VoiceHint text="Say an option, its number, or answer in your own words" />
    </div>
  );
}

function TrustBody({ session }: { session: SessionView }) {
  const { perform } = useCallsign();
  return (
    <div className="flex flex-col gap-2 px-3 pb-2.5">
      <p className="text-[13px] text-ink">Claude has not seen this folder before and asks whether you trust it:</p>
      <pre className="overflow-x-auto rounded-inner border border-line bg-canvas px-2.5 py-2 font-mono text-[12px] whitespace-pre-wrap text-ink-muted">{session.projectPath}</pre>
      <VoiceHint text="Say trust it" />
      <div className="flex gap-1">
        <ActionButton tone="primary" onClick={() => perform({ type: "trust", session: session.name })}>
          Trust folder
        </ActionButton>
      </div>
    </div>
  );
}

function MessageBody({ item, session }: { item: AttentionItem; session: SessionView }) {
  const { perform } = useCallsign();
  const headline = item.headline.replace(`${session.name} `, "");
  return (
    <div className="flex flex-col gap-2 px-3 pb-2.5">
      <p className="text-[13px] leading-snug text-ink">{headline.charAt(0).toUpperCase() + headline.slice(1)}</p>
      <VoiceHint text={item.kind === "question" ? `Answer out loud, or say ${session.name} and your reply` : `Say go to ${session.name}, or catch me up`} />
      <div className="flex gap-1">
        <ActionButton onClick={() => perform({ type: "focus", session: session.name })}>Open</ActionButton>
      </div>
    </div>
  );
}

function VoiceHint({ text }: { text: string }) {
  return <p className="text-[12px] text-ink-faint">{text}</p>;
}

function ActionButton({ children, onClick, tone = "plain" }: { children: React.ReactNode; onClick: () => void; tone?: "primary" | "plain" }) {
  const toneClass = tone === "primary" ? "bg-ink text-canvas hover:bg-white" : "border border-line bg-panel text-ink hover:border-line-strong";
  return (
    <button type="button" onClick={onClick} className={`press h-8 flex-1 cursor-pointer rounded-inner px-3 text-[13px] font-medium shadow-press ${toneClass}`}>
      {children}
    </button>
  );
}
