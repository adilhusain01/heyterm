// The assistant in the middle: a line as dictation heard it, what the assistant checked, and the
// instruction it sent. The three examples are real requests from one developer's evening (25 October
// 2026), trimmed; the assistant's replies are the ones it gave. Picking an example runs it once.

import { useState, type ReactNode } from "react";
import { AssistantOrb } from "../../../src/web/ui/AssistantOrb.tsx";
import { CheckIcon } from "../../../src/web/ui/icons.tsx";
import { Face } from "../Face.tsx";
import { Section, SectionHeading } from "../pieces.tsx";
import { BeamLine, useReducedMotion } from "./kit.tsx";

interface Example {
  label: string;
  heard: ReactNode;
  checks: string[];
  asks: boolean;
  sent: string;
  saidBack: string;
}

function Misheard({ children }: { children: ReactNode }) {
  return <span className="underline decoration-accent decoration-wavy decoration-[1.5px] underline-offset-4">{children}</span>;
}

const examples: Example[] = [
  {
    label: "A misheard word",
    heard: (
      <>
        <Misheard>march</Misheard> 84, not before
      </>
    ),
    checks: ["Read synqed's last message: pull requests to merge before its deploy", "Took “march” for “merge”, and 84 for pull request 84", "Still unsure what you meant, so it asks instead of guessing"],
    asks: true,
    sent: "What is pull request 84, and does it need merging before the deploy?",
    saidBack: "I heard that as a question about pull request 84, so I asked Synqed what it is and whether it needs merging first. If you meant something else, tell me.",
  },
  {
    label: "Shorthand",
    heard: <>do I also need to merge it before? ask it</>,
    checks: ["“It” is synqed, the session about to deploy", "“Before” is before its production deploy", "Wrote the question so synqed can act on the answer"],
    asks: false,
    sent: "Before you deploy to production, does anything else need merging first, such as a release from dev to main? If so, open the pull request and say so.",
    saidBack: "I asked Synqed whether anything else needs merging before it deploys. If it does, it opens the pull request and tells you.",
  },
  {
    label: "What already happened",
    heard: <>I merged in order, first 86 then 87 then 85, now tell it what remains</>,
    checks: ["Matched 86, 87 and 85 to the pull requests synqed asked for", "“What remains” is the rest of synqed's own plan", "Kept your order, since synqed asked for that order"],
    asks: false,
    sent: "All three are merged, in the order you asked: 86, 87, then 85. Go on with what remains: the keys and the webhook, the settings, a deploy and an end-to-end check.",
    saidBack: "I told Synqed you merged all three in order. It's going on with the rest: the keys and webhook, its settings, a deploy and an end-to-end check.",
  },
];

const tools = ["every session's screen and last message", "git, gh and npm", "your notes and MCP servers", "the screen, when you ask", "the web"];

export function AssistantInTheMiddle() {
  const [chosen, setChosen] = useState(0);
  const [play, setPlay] = useState(0);
  const reducedMotion = useReducedMotion();
  const example = examples[chosen]!;
  const choose = (index: number) => {
    setChosen(index);
    setPlay((count) => count + 1);
  };
  return (
    <Section id="assistant">
      <SectionHeading title="Say it loosely. The assistant sends it clearly.">
        <p>
          Dictation mishears, and you talk in shorthand. Anything you say that does not start with a session's name goes to the assistant first: it works out which session you mean, checks what was already said and done, fixes misheard words and sends a clear instruction. When it cannot tell, it asks you.
        </p>
      </SectionHeading>
      <div className="mt-10 flex flex-col gap-4 rounded-outer border border-line bg-panel p-3 sm:p-6">
        <div role="radiogroup" aria-label="Example" className="flex flex-wrap gap-0.5 self-start rounded-inner border border-line bg-tray p-0.5 shadow-tray">
          {examples.map((candidate, index) => (
            <button
              key={candidate.label}
              type="button"
              role="radio"
              aria-checked={index === chosen}
              onClick={() => choose(index)}
              className={`press inline-flex h-8 cursor-pointer items-center rounded-small px-3 text-meta transition-[background-color,color,box-shadow] duration-150 ${index === chosen ? "bg-key text-ink shadow-key" : "text-ink-muted hover:text-ink"}`}
            >
              {candidate.label}
            </button>
          ))}
        </div>
        <div className="grid items-stretch gap-0 lg:grid-cols-[minmax(0,0.9fr)_48px_minmax(0,1.15fr)_48px_minmax(0,1.15fr)]">
          <Stage title="What dictation heard">
            <p key={chosen} className="status-swap font-mono text-body leading-relaxed text-ink">
              "{example.heard}"
            </p>
          </Stage>
          <Flow id="assistant-flow-in" play={play} delayMilliseconds={0} />
          <Stage title="What the assistant checked" orb>
            <ol key={chosen} className="flex flex-col gap-2">
              {example.checks.map((check, index) => (
                <li
                  key={check}
                  style={{ transitionDelay: reducedMotion ? "0ms" : `${180 + index * 140}ms` }}
                  className="flex items-start gap-2 text-meta leading-snug text-ink transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
                >
                  <CheckIcon size={14} className={`mt-0.5 shrink-0 ${example.asks && index === example.checks.length - 1 ? "text-question" : "text-finished"}`} />
                  {check}
                </li>
              ))}
            </ol>
          </Stage>
          <Flow id="assistant-flow-out" play={play} delayMilliseconds={620} />
          <Stage title={example.asks ? "What it asked synqed" : "What it sent synqed"}>
            <div key={chosen} className="status-swap flex flex-col gap-2.5">
              <span className="flex items-center gap-2">
                <Face name="synqed" size={22} />
                <span className="font-mono text-meta text-ink">synqed</span>
              </span>
              <p className="rounded-inner border border-line-strong bg-key px-3 py-2 text-body leading-relaxed text-ink">{example.sent}</p>
            </div>
          </Stage>
        </div>
        <div key={chosen} className="status-swap flex items-start gap-3 px-1">
          <AssistantOrb state="speaking" size={22} label="The assistant, speaking" />
          <p className="text-body leading-relaxed text-ink">{example.saidBack}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
        <div className="flex flex-col gap-3">
          <h3 className="text-title font-medium text-ink">What it can look at before it sends</h3>
          <ul className="flex flex-wrap gap-1.5">
            {tools.map((tool) => (
              <li key={tool} className="rounded-small border border-line bg-canvas px-2.5 py-1 text-small text-ink-muted">
                {tool}
              </li>
            ))}
          </ul>
          <p className="text-body leading-relaxed text-ink-muted">It is Claude Opus 5.5 on your own Claude Code login, so there is no API key, and it works within your Claude Code permission mode. It remembers your conversation across restarts.</p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-title font-medium text-ink">Or skip it</h3>
          <p className="text-body leading-relaxed text-ink-muted">
            Start with a session's name and say exactly what to do, and your words go straight there after a short preview you can cancel, with no assistant in between.
          </p>
          <p className="w-fit rounded-inner bg-raised px-3 py-1.5 text-body text-ink">"whisker, run the tests"</p>
        </div>
      </div>
    </Section>
  );
}

function Stage({ title, orb = false, children }: { title: string; orb?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-inner border border-line-strong bg-canvas p-4">
      <span className="flex items-center gap-2 text-small text-ink-faint">
        {orb && <AssistantOrb state="thinking" size={18} label="The assistant" />}
        {title}
      </span>
      {children}
    </div>
  );
}

// The line between two stages: across on a wide screen, down on a phone, with a beam on each run.
function Flow({ id, play, delayMilliseconds }: { id: string; play: number; delayMilliseconds: number }) {
  const run = { play, delayMilliseconds, reverse: false };
  return (
    <div className="flex items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 48 40" className="hidden h-10 w-12 lg:block">
        <BeamLine id={`${id}-wide`} from={[0, 20]} to={[42, 20]} lit run={run} />
        <polygon points="40 15, 48 20, 40 25" className="fill-accent" />
      </svg>
      <svg viewBox="0 0 40 40" className="h-10 w-10 lg:hidden">
        <BeamLine id={`${id}-narrow`} from={[20, 0]} to={[20, 34]} lit run={run} />
        <polygon points="15 32, 20 40, 25 32" className="fill-accent" />
      </svg>
    </div>
  );
}
