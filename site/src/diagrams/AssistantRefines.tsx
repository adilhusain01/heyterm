// The assistant in the middle: a line as dictation heard it, what the assistant checked, and what it
// sent. The three examples are real requests from one developer's evening (25 October 2026), cut short.
// Picking an example runs it once.

import { useState, type ReactNode } from "react";
import { AssistantOrb } from "../../../src/web/ui/AssistantOrb.tsx";
import { CheckIcon } from "../../../src/web/ui/icons.tsx";
import { Face } from "../Face.tsx";
import { SaidLine, Section, SectionHeading } from "../pieces.tsx";
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
    label: "Misheard",
    heard: (
      <>
        <Misheard>march</Misheard> 84, not before
      </>
    ),
    checks: ["Read synqed's last message", "“March” means merge, 84 a pull request", "Not sure, so it asks"],
    asks: true,
    sent: "What is pull request 84, and does it need merging before the deploy?",
    saidBack: "I took that as pull request 84 and asked synqed. Tell me if you meant something else.",
  },
  {
    label: "Shorthand",
    heard: <>do I also need to merge it before? ask it</>,
    checks: ["“It” is synqed, about to deploy", "“Before” means before the deploy"],
    asks: false,
    sent: "Does anything else need merging before you deploy? If so, open the pull request.",
    saidBack: "I asked synqed whether anything else needs merging first.",
  },
  {
    label: "Context",
    heard: <>merged 86 then 87 then 85, now tell it what remains</>,
    checks: ["Matched the numbers to synqed's list", "Kept your order"],
    asks: false,
    sent: "All three are merged: 86, 87, then 85. Go on with the rest of your plan.",
    saidBack: "I told synqed all three are merged. It's carrying on.",
  },
];

const canRead = ["every session", "git and npm", "your notes", "the screen", "the web"];

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
      <SectionHeading title="Say it loosely. It sends it clearly.">
        <p>Dictation mishears. The assistant fixes it, checks the facts, and asks when it isn't sure.</p>
      </SectionHeading>
      <div className="mt-10 flex flex-col gap-5 rounded-outer border border-line bg-panel p-3 sm:p-6">
        <div role="radiogroup" aria-label="Example" className="flex flex-wrap gap-0.5 self-start rounded-inner border border-line bg-tray p-0.5 shadow-tray">
          {examples.map((candidate, index) => (
            <button
              key={candidate.label}
              type="button"
              role="radio"
              aria-checked={index === chosen}
              onClick={() => choose(index)}
              className={`press inline-flex h-8 cursor-pointer items-center rounded-small px-3.5 text-meta transition-[background-color,color,box-shadow] duration-150 ${index === chosen ? "bg-key text-ink shadow-key" : "text-ink-muted hover:text-ink"}`}
            >
              {candidate.label}
            </button>
          ))}
        </div>
        <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)_56px_minmax(0,1fr)]">
          <Stage title="You said">
            <p key={chosen} className="status-swap font-mono text-title leading-relaxed text-ink">
              "{example.heard}"
            </p>
          </Stage>
          <Flow id="assistant-flow-in" play={play} delayMilliseconds={0} />
          <Stage title="It checked" orb>
            <ol key={chosen} className="flex flex-col gap-2.5">
              {example.checks.map((check, index) => (
                <li
                  key={check}
                  style={{ transitionDelay: reducedMotion ? "0ms" : `${180 + index * 140}ms` }}
                  className="flex items-start gap-2 text-body leading-snug text-ink transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
                >
                  <CheckIcon size={15} className={`mt-0.5 shrink-0 ${example.asks && index === example.checks.length - 1 ? "text-question" : "text-finished"}`} />
                  {check}
                </li>
              ))}
            </ol>
          </Stage>
          <Flow id="assistant-flow-out" play={play} delayMilliseconds={620} />
          <Stage title={example.asks ? "It asked" : "It sent"}>
            <div key={chosen} className="status-swap flex flex-col gap-3">
              <span className="flex items-center gap-2">
                <Face name="synqed" size={22} />
                <span className="font-mono text-meta text-ink">synqed</span>
              </span>
              <p className="text-body leading-relaxed text-ink">{example.sent}</p>
            </div>
          </Stage>
        </div>
        <div key={chosen} className="status-swap flex items-start gap-3 px-1">
          <AssistantOrb state="speaking" size={22} label="The assistant, speaking" />
          <p className="text-body leading-relaxed text-ink-muted">{example.saidBack}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="What the assistant can read">
          <li className="mr-1 text-meta text-ink-muted">It can read</li>
          {canRead.map((thing) => (
            <li key={thing} className="rounded-small border border-line bg-canvas px-2.5 py-1 text-small text-ink-muted">
              {thing}
            </li>
          ))}
        </ul>
        <span className="flex flex-wrap items-center gap-2 text-meta text-ink-muted">
          Or name a session to skip it: <SaidLine>whisker, run the tests</SaidLine>
        </span>
      </div>
    </Section>
  );
}

function Stage({ title, orb = false, children }: { title: string; orb?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-inner border border-line-strong bg-canvas p-5">
      <span className="flex items-center gap-2 text-meta text-ink-faint">
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
      <svg viewBox="0 0 56 40" className="hidden h-10 w-14 lg:block">
        <BeamLine id={`${id}-wide`} from={[4, 20]} to={[46, 20]} lit run={run} />
        <polygon points="44 15, 52 20, 44 25" className="fill-accent" />
      </svg>
      <svg viewBox="0 0 40 40" className="h-10 w-10 lg:hidden">
        <BeamLine id={`${id}-narrow`} from={[20, 2]} to={[20, 32]} lit run={run} />
        <polygon points="15 30, 20 38, 25 30" className="fill-accent" />
      </svg>
    </div>
  );
}
