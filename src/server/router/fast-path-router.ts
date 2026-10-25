// Routes the common spoken commands at once, without a model. Returns undefined when the model should decide.

import { SessionNames } from "../../shared/session-names.ts";
import { HeadAnswerRouter } from "./head-answer-router.ts";
import { SpokenNameMatcher } from "./spoken-name-matcher.ts";
import { SpokenPhrases, normalizedPhrase, spokenOrdinal, textFromWord, withoutNameFiller, wordSpans, type WordSpan } from "./utterance-text.ts";
import type { AgentKind, RouterAction, RoutingContext, SessionView } from "../../shared/types.ts";

interface SessionCommand {
  pattern: RegExp;
  build: (session: string) => RouterAction;
  // Names a closed session rather than a running one.
  isResume?: boolean;
}

// Each pattern captures the words naming the session.
const sessionCommands: SessionCommand[] = [
  { pattern: /^(?:what's|what is|how's|how is) (.+?) (?:doing|up to)$/, build: (session) => ({ type: "status", session }) },
  { pattern: /^status (?:of|for) (.+)$/, build: (session) => ({ type: "status", session }) },
  { pattern: /^what (?:did|has) (.+?) (?:change|changed|edit|edited)$/, build: (session) => ({ type: "changes", session }) },
  // Before focus, which would read "open synqed here" as showing a session called "synqed here".
  { pattern: /^(?:open|move|bring|pull) (.+?) (?:here|over here|into heyterm|in heyterm|to heyterm)$/, build: (session) => ({ type: "adopt", session, confirmed: false }) },
  { pattern: /^(?:go to|show me|show|switch to|focus on|focus|look at|bring up|open) (.+)$/, build: (session) => ({ type: "focus", session }) },
  { pattern: /^(?:close|kill|end|shut down|quit|exit) (.+)$/, build: (session) => ({ type: "close", session, confirmed: false }) },
  { pattern: /^(?:stop|interrupt|pause|halt|hold) (.+)$/, build: (session) => ({ type: "interrupt", session }) },
  { pattern: /^(?:bring back|resume|reopen|restart) (.+)$/, build: (session) => ({ type: "resume", session }), isResume: true },
];

const spawnPattern = /^(?:start|open|spin up|create|launch|begin)(?: a| an)?(?: new)?(?: (claude|codex|gemini|grok(?: build)?|cursor))?(?: (session|agent|terminal|shell))? (?:in|on|for|at) /;
const taskJoinWords = new Set(["and", "to", "then", "so"]);

export interface FastPathOptions {
  // Without the assistant, words that name no session go to the focused one. With it, they go to the assistant.
  sendUnaddressedWordsToFocusedSession: boolean;
}

export class FastPathRouter {
  constructor(private readonly options: FastPathOptions = { sendUnaddressedWordsToFocusedSession: true }) {}

  route(utterance: string, context: RoutingContext): RouterAction | undefined {
    const phrase = normalizedPhrase(utterance);
    if (!phrase) return undefined;
    const spans = wordSpans(utterance);
    const sessionMatcher = new SpokenNameMatcher(context.sessions.map((session) => session.name));
    return (
      this.routeControlPhrase(phrase, context) ??
      this.routeSpawn(utterance, spans, context) ??
      this.routeRename(phrase, sessionMatcher, context) ??
      this.routeSessionCommand(phrase, sessionMatcher, context) ??
      // With the assistant in the middle, "tell X to" goes to it, which works out what X should be told.
      (this.options.sendUnaddressedWordsToFocusedSession ? this.routeTell(utterance, spans, sessionMatcher) : undefined) ??
      new HeadAnswerRouter().route(utterance, phrase, context, sessionMatcher) ??
      this.routeAddressed(utterance, spans, sessionMatcher) ??
      (this.options.sendUnaddressedWordsToFocusedSession ? this.routeToFocusedSession(utterance, phrase, context, sessionMatcher) : undefined)
    );
  }

  private routeControlPhrase(phrase: string, context: RoutingContext): RouterAction | undefined {
    // Something waits for a yes (the assistant asking, or closing a busy session): answer it at once.
    if (context.hasPendingConfirmation) {
      if (SpokenPhrases.yes.test(phrase) || SpokenPhrases.confirm.test(phrase)) return { type: "confirm" };
      if (SpokenPhrases.no.test(phrase) || SpokenPhrases.cancelPreview.test(phrase)) return { type: "cancel" };
    }
    if (context.hasPendingPreview) {
      if (SpokenPhrases.cancelPreview.test(phrase)) return { type: "cancel" };
      if (SpokenPhrases.sendNow.test(phrase)) return { type: "send_now" };
    }
    if (context.pendingClarifyOptions) {
      const index = spokenOrdinal(phrase);
      if (index !== undefined) return { type: "choose", index: index === -1 ? context.pendingClarifyOptions.length - 1 : index };
      const named = new SpokenNameMatcher(context.pendingClarifyOptions).findBest(phrase);
      if (named) return { type: "choose", index: context.pendingClarifyOptions.indexOf(named.name) };
    }
    if (SpokenPhrases.quiet.test(phrase)) return { type: "mode", mode: "quiet" };
    if (SpokenPhrases.mute.test(phrase)) return { type: "mode", mode: "mute" };
    if (SpokenPhrases.speak.test(phrase)) return { type: "mode", mode: "speak" };
    if (SpokenPhrases.catchUp.test(phrase)) return { type: "catch_up" };
    return undefined;
  }

  private routeSpawn(utterance: string, spans: WordSpan[], context: RoutingContext): RouterAction | undefined {
    const phrase = normalizedPhrase(utterance);
    const prefix = spawnPattern.exec(phrase);
    if (!prefix) return undefined;
    const firstProjectWord = prefix[0].trim().split(" ").length;
    const restWords = spans.slice(firstProjectWord).map((span) => span.word);
    const projectMatcher = new SpokenNameMatcher(context.projectNames);
    for (let wordCount = Math.min(SpokenNameMatcher.longestNameInWords, restWords.length); wordCount >= 1; wordCount -= 1) {
      const project = projectMatcher.findBest(withoutNameFiller(restWords.slice(0, wordCount)).join(" "));
      if (!project) continue;
      let taskWordIndex = firstProjectWord + wordCount;
      while (spans[taskWordIndex] && taskJoinWords.has(spans[taskWordIndex]!.word)) taskWordIndex += 1;
      const task = textFromWord(utterance, spans, taskWordIndex);
      // Claude Code is the default, so it is not named in the action.
      const agent: AgentKind | undefined = namedAgent(prefix[1], prefix[2]);
      if (agent === "shell" && task) return undefined;
      return { type: "spawn", project: project.name, ...(agent ? { agent } : {}), ...(task ? { task } : {}) };
    }
    return undefined;
  }

  // "rename synqed to synqed auth": an open session first, then a recently closed one.
  private routeRename(phrase: string, sessionMatcher: SpokenNameMatcher, context: RoutingContext): RouterAction | undefined {
    const match = /^rename (.+?) (?:to|as) (.+)$/.exec(phrase);
    if (!match?.[1] || !match[2]) return undefined;
    const spokenName = withoutNameFiller(match[1].split(" ")).join(" ");
    const session = sessionMatcher.findBest(spokenName) ?? new SpokenNameMatcher(context.recentlyClosedNames ?? []).findBest(spokenName);
    if (!session) return undefined;
    return { type: "rename", session: session.name, newName: SessionNames.fromTyped(match[2]) };
  }

  private routeSessionCommand(phrase: string, sessionMatcher: SpokenNameMatcher, context: RoutingContext): RouterAction | undefined {
    for (const command of sessionCommands) {
      const match = command.pattern.exec(phrase);
      if (!match?.[1]) continue;
      const spokenName = withoutNameFiller(match[1].split(" ")).join(" ");
      // Bringing back looks among closed sessions first; everything else among running ones.
      const closedMatch = command.isResume ? new SpokenNameMatcher(context.recentlyClosedNames ?? []).findBest(spokenName) : undefined;
      const session = closedMatch ?? sessionMatcher.findBest(spokenName);
      if (session) return command.build(session.name);
    }
    return undefined;
  }

  // "tell book boy to use the brand colors", "ask peeker why the tests fail"
  private routeTell(utterance: string, spans: WordSpan[], sessionMatcher: SpokenNameMatcher): RouterAction | undefined {
    if (!["tell", "ask"].includes(spans[0]?.word ?? "")) return undefined;
    const mention = sessionMatcher.findMentions(utterance).find((found) => found.firstWordIndex <= 2);
    if (!mention) return undefined;
    let textWordIndex = mention.lastWordIndex + 1;
    while (spans[textWordIndex] && ["session", "agent", "one", "to"].includes(spans[textWordIndex]!.word)) textWordIndex += 1;
    const text = textFromWord(utterance, spans, textWordIndex);
    return text ? { type: "send", session: mention.name, text, needsPreview: true } : undefined;
  }

  // "Peeker, run the tests again."
  private routeAddressed(utterance: string, spans: WordSpan[], sessionMatcher: SpokenNameMatcher): RouterAction | undefined {
    const mentions = sessionMatcher.findMentions(utterance);
    const [first] = mentions;
    if (!first || first.firstWordIndex !== 0 || mentions.length > 1) return undefined;
    const text = textFromWord(utterance, spans, first.lastWordIndex + 1);
    return text ? { type: "send", session: first.name, text, needsPreview: true } : undefined;
  }

  private routeToFocusedSession(utterance: string, phrase: string, context: RoutingContext, sessionMatcher: SpokenNameMatcher): RouterAction | undefined {
    if (sessionMatcher.findMentions(utterance).length > 0) return undefined;
    const focused = context.sessions.find((session) => session.name === context.focusedSession);
    if (!focused || !acceptsText(focused)) return undefined;
    if (SpokenPhrases.yes.test(phrase) || SpokenPhrases.no.test(phrase)) return undefined;
    return { type: "send", session: focused.name, text: utterance.trim(), needsPreview: true };
  }
}

// A session showing a dialog would take typed text as keys pressed in the dialog.
export function acceptsText(session: SessionView): boolean {
  return !["needs_permission", "needs_trust", "stopped", "starting"].includes(session.state) && session.pending === undefined && !session.blockedByTerminalDialog;
}

// The agent named before "session", as said: "grok build" is Grok. Claude Code is the default, and
// "a terminal" or "a shell" with no agent named is a plain terminal.
function namedAgent(spoken: string | undefined, noun: string | undefined): AgentKind | undefined {
  if (spoken === "codex" || spoken === "gemini" || spoken === "cursor") return spoken;
  if (spoken?.startsWith("grok")) return "grok";
  if (!spoken && (noun === "terminal" || noun === "shell")) return "shell";
  return undefined;
}
