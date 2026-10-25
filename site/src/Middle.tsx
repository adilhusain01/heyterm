// The middle of the story: why it exists (measured), how it works, and what you say to it.

import { SaidLine, Section, SectionHeading } from "./pieces.tsx";

// Measured on one developer's Mac over two weeks (scripts/measure-waits.py in the repo).
const measuredWaits = 179;

export function Waits() {
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
        <SectionHeading title="Agents wait on you more than you notice.">
          <p>
            Run four or five agents and each one keeps stopping: it finished, it has a question, it wants to run a command. You are busy in another one, so it sits there.
          </p>
          <p>
            On one developer's Mac over two weeks, sessions finished or stopped to ask something {measuredWaits} times while the developer was busy in another session.
            Those waits added up to 55 hours of agents doing nothing.
          </p>
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

const steps = [
  {
    title: "Start them by voice",
    text: "Say which agent and which project. HeyTerm opens it in its own terminal on your computer, and the session shows up with a face of its own.",
    said: "start a grok session in shop and run the tests",
  },
  {
    title: "Talk to any of them",
    text: "Name a session and your words go straight to it. Anything else goes to the assistant in the middle, which reads every session, sends them work and answers you out loud.",
    said: "what is everyone doing?",
  },
  {
    title: "Answer when one needs you",
    text: "A permission, a question or a folder to trust arrives as a message in the conversation and is said out loud in plain words. Answer it there, or just say so.",
    said: "approve",
  },
];

export function HowItWorks() {
  return (
    <Section id="how">
      <SectionHeading title="How it works" />
      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        {steps.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-4 border-t border-line-strong pt-6">
            <span className="display text-[28px] text-accent-ink" aria-hidden>
              {index + 1}
            </span>
            <h3 className="text-title font-medium text-ink">{step.title}</h3>
            <p className="text-body leading-relaxed text-ink-muted">{step.text}</p>
            <SaidLine>{step.said}</SaidLine>
          </li>
        ))}
      </ol>
    </Section>
  );
}

const phrases: Array<{ said: string; does: string }> = [
  { said: "start a session in portfolio and fix the phone menu", does: "Starts Claude Code there and gives it the task." },
  { said: "peeker, run the tests again", does: "Sends your words to that session, after a short preview you can cancel." },
  { said: "no, use pnpm instead", does: "Denies the permission and passes your reason on, so the agent changes course." },
  { said: "the second one", does: "Answers a multiple-choice question, no arrow keys." },
  { said: "catch me up", does: "Says what changed in every session since you last looked." },
  { said: "trust it", does: "Trusts a new folder for the session asking." },
  { said: "bring back peeker", does: "Resumes a closed session where its conversation left off." },
  { said: "what did api change?", does: "Names the files its last task changed, with line counts." },
  { said: "rename synqed to synqed auth", does: "Renames a session, so two in one project are easy to tell apart." },
  { said: "be quiet", does: "Speaks only permissions and questions. Say \"mute\" for sounds only." },
];

export function WhatYouSay() {
  return (
    <Section>
      <SectionHeading title="Say it the way you would say it to a person.">
        <p>Plain decisions and anything that names a session happen at once. Everything else goes to the assistant, which works out what you meant.</p>
      </SectionHeading>
      <dl className="mt-12 grid gap-x-10 gap-y-6 md:grid-cols-2">
        {phrases.map((phrase) => (
          <div key={phrase.said} className="flex flex-col gap-2.5">
            <dt>
              <SaidLine>{phrase.said}</SaidLine>
            </dt>
            <dd className="pl-1 text-body text-ink-muted">{phrase.does}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
