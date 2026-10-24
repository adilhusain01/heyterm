// Answers to whatever sits at the top of the attention queue: a permission, a question or a trust dialog.

import { SpokenNameMatcher } from "./spoken-name-matcher.ts";
import { SpokenPhrases, spokenOrdinal, wordSpans } from "./utterance-text.ts";
import type { PendingPermission, PendingQuestion, RouterAction, RoutingContext } from "../../shared/types.ts";

export class HeadAnswerRouter {
  route(utterance: string, phrase: string, context: RoutingContext, sessionMatcher: SpokenNameMatcher): RouterAction | undefined {
    const namedApproval = this.routeNamedApproval(phrase, context, sessionMatcher);
    if (namedApproval) return namedApproval;
    const head = context.attentionHead;
    const session = head ? context.sessions.find((candidate) => candidate.name === head.sessionName) : undefined;
    if (!session) return SpokenPhrases.confirm.test(phrase) ? { type: "confirm" } : undefined;
    // Words would be typed into the dialog as key presses; it has to be answered in the terminal.
    if (session.blockedByTerminalDialog) return undefined;
    const mentionsAnotherSession = sessionMatcher.findMentions(utterance).some((mention) => mention.name !== session.name);
    if (session.pending?.kind === "permission") return this.routePermissionAnswer(utterance, phrase, session.name, session.pending);
    if (SpokenPhrases.confirm.test(phrase)) return { type: "confirm" };
    if (session.state === "needs_trust") return this.routeTrustAnswer(phrase, session.name);
    if (mentionsAnotherSession) return undefined;
    if (session.pending?.kind === "question") return this.routeQuestionAnswer(utterance, phrase, session.name, session.pending);
    if (session.state === "asked") return { type: "send", session: session.name, text: utterance.trim(), needsPreview: false };
    return undefined;
  }

  // "approve peeker" approves that session's permission wherever it sits in the queue.
  private routeNamedApproval(phrase: string, context: RoutingContext, sessionMatcher: SpokenNameMatcher): RouterAction | undefined {
    const match = /^(approve|allow|accept|deny|reject) (?:for )?(.+)$/.exec(phrase);
    if (!match?.[1] || !match[2]) return undefined;
    const named = sessionMatcher.findBest(match[2]);
    const session = named ? context.sessions.find((candidate) => candidate.name === named.name) : undefined;
    if (session?.pending?.kind !== "permission") return undefined;
    const requestId = session.pending.requestId;
    if (match[1] === "deny" || match[1] === "reject") return { type: "deny", session: session.name, requestId };
    return { type: "approve", session: session.name, requestId, confirmed: false };
  }

  private routePermissionAnswer(utterance: string, phrase: string, sessionName: string, pending: PendingPermission): RouterAction | undefined {
    const requestId = pending.requestId;
    if (SpokenPhrases.confirm.test(phrase)) return { type: "approve", session: sessionName, requestId, confirmed: true };
    if (SpokenPhrases.yes.test(phrase)) return { type: "approve", session: sessionName, requestId, confirmed: false };
    if (SpokenPhrases.no.test(phrase)) {
      const reason = denialReason(utterance);
      return reason ? { type: "deny", session: sessionName, requestId, reason } : { type: "deny", session: sessionName, requestId };
    }
    return undefined;
  }

  private routeTrustAnswer(phrase: string, sessionName: string): RouterAction | undefined {
    if (SpokenPhrases.yes.test(phrase) || /^trust( (it|this|that|the folder|the project))?$/.test(phrase)) {
      return { type: "trust", session: sessionName };
    }
    return undefined;
  }

  private routeQuestionAnswer(utterance: string, phrase: string, sessionName: string, pending: PendingQuestion): RouterAction | undefined {
    // Several questions at once need the model to split the answer.
    if (pending.questions.length !== 1) return undefined;
    const [question] = pending.questions as [PendingQuestion["questions"][number]];
    const labels = question.options.map((option) => option.label);
    const chosenLabel = chosenOptionLabel(phrase, labels) ?? utterance.trim();
    return { type: "answer", session: sessionName, requestId: pending.requestId, answers: { [question.question]: chosenLabel } };
  }
}

function chosenOptionLabel(phrase: string, labels: string[]): string | undefined {
  const index = spokenOrdinal(phrase);
  if (index !== undefined) return index === -1 ? labels.at(-1) : labels[index];
  const exact = new SpokenNameMatcher(labels).findBest(phrase);
  if (exact) return exact.name;
  // "let's go with Neon": a short sentence that names exactly one option.
  if (phrase.split(" ").length > 6) return undefined;
  const named = labels.filter((label) => containsWords(phrase, label));
  return named.length === 1 ? named[0] : undefined;
}

function containsWords(phrase: string, label: string): boolean {
  const labelWords = wordSpans(label).map((span) => span.word).join(" ");
  return labelWords.length > 0 && ` ${phrase} `.includes(` ${labelWords} `);
}

// "No, use pnpm build instead." gives "use pnpm build instead".
function denialReason(utterance: string): string | undefined {
  const reason = utterance
    .trim()
    .replace(/^(no|nope|nah|deny|reject|don't|do not)\b[\s,.:;!-]*/i, "")
    .replace(/[.!\s]+$/, "")
    .trim();
  return reason || undefined;
}

