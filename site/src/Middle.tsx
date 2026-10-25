// The middle of the story: why it exists (measured), how it works, and what you say to it.

import { HowItWorksDiagram } from "./diagrams/RoutingDiagram.tsx";
import { SaidLine, Section, SectionHeading } from "./pieces.tsx";

// Measured on one developer's Mac over two weeks (scripts/measure-waits.py in the repo).
const measuredWaits = 179;

export function Waits() {
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
        <SectionHeading title="Agents wait on you more than you notice.">
          <p>Over two weeks, one developer's agents sat waiting {measuredWaits} times while they were busy in another. That is 55 hours of agents doing nothing.</p>
        </SectionHeading>
        <figure className="flex flex-col gap-4">
          <div role="img" aria-label={`${measuredWaits} squares, one for each time a session waited`} className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-1.5">
            {Array.from({ length: measuredWaits }, (_, index) => (
              <span key={index} className="aspect-square rounded-mark bg-permission/75" />
            ))}
          </div>
          <figcaption className="flex flex-wrap gap-x-6 gap-y-1 text-small text-ink-muted">
            <span>
              <span className="font-mono text-ink">{measuredWaits}</span> waits
            </span>
            <span>
              <span className="font-mono text-ink">55 h</span> in all
            </span>
            <span>
              <span className="font-mono text-ink">5.5 min</span> typical
            </span>
            <span>
              <span className="font-mono text-ink">3 h 25 min</span> longest
            </span>
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}

export function HowItWorks() {
  return (
    <Section id="how">
      <SectionHeading title="How it works">
        <p>Pick a step.</p>
      </SectionHeading>
      <HowItWorksDiagram />
    </Section>
  );
}

const phrases: Array<{ said: string; does: string }> = [
  { said: "start a session in portfolio", does: "Starts Claude Code there" },
  { said: "peeker, run the tests again", does: "Goes straight to peeker" },
  { said: "no, use pnpm instead", does: "Says no, with your reason" },
  { said: "the second one", does: "Picks an answer" },
  { said: "catch me up", does: "What happened while you were away" },
  { said: "trust it", does: "Trusts a new folder" },
  { said: "bring back peeker", does: "Reopens a closed session" },
  { said: "what did api change?", does: "Lists the files it changed" },
  { said: "rename synqed to synqed auth", does: "Renames a session" },
  { said: "open a terminal in synqed", does: "Opens a plain terminal" },
  { said: "open synqed here", does: "Moves a session into HeyTerm" },
  { said: "be quiet", does: "Speaks only what needs you" },
];

export function WhatYouSay() {
  return (
    <Section>
      <SectionHeading title="Say it like you would to a person." />
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {phrases.map((phrase) => (
          <li key={phrase.said} className="flex flex-col gap-2.5 rounded-outer border border-line bg-panel p-4">
            <SaidLine>{phrase.said}</SaidLine>
            <span className="pl-1 text-meta text-ink-muted">{phrase.does}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
