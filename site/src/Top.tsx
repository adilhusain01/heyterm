// The top of the page: the bar along the top, the hero with its live demo, and the agents it runs.

import { agents } from "./agents.ts";
import { AgentMark } from "./AgentMark.tsx";
import { LiveDemo } from "./LiveDemo.tsx";
import { CopyCommand, ThemeToggle } from "./pieces.tsx";

export const links = {
  github: "https://github.com/adilhusain01/heyterm",
  npm: "https://www.npmjs.com/package/heyterm",
  playground: "/playground/",
};

export function TopBar() {
  return (
    <header className="mx-auto flex w-full max-w-[1280px] items-center gap-3 px-4 pt-5 sm:px-6">
      <a href="/" className="flex items-center gap-2.5 rounded-inner" aria-label="HeyTerm home">
        <img src="/favicon.svg" alt="" width={28} height={28} />
        <span className="display text-[17px] text-ink">HeyTerm</span>
      </a>
      <nav aria-label="Main" className="ml-auto flex items-center gap-1">
        <a href="#how" className="hidden rounded-inner px-3 py-2 text-meta text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink sm:block">
          How it works
        </a>
        <a href="#start" className="hidden rounded-inner px-3 py-2 text-meta text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink sm:block">
          Install
        </a>
        <a href={links.github} className="rounded-inner px-3 py-2 text-meta text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink">
          GitHub
        </a>
        <ThemeToggle />
      </nav>
    </header>
  );
}

export function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-[1280px] flex-col items-center gap-14 px-4 pt-16 pb-10 sm:px-6 md:pt-24">
      <div className="flex max-w-[1080px] flex-col items-center gap-6 text-center">
        <h1 className="display text-hero text-ink">
          Run every coding agent <span className="md:block">in one window, by voice.</span>
        </h1>
        <p className="lede max-w-[46ch] text-lede text-ink-muted">Claude Code, Codex, Gemini, Grok and Cursor side by side. Talk to them, and hear when one needs you.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <CopyCommand command="npx heyterm" size="large" />
          <a
            href={links.playground}
            className="press key-lift inline-flex h-12 items-center rounded-inner bg-primary px-5 text-body font-medium text-primary-ink shadow-key hover:bg-primary-hover"
          >
            Try the playground
          </a>
        </div>
        <p className="text-small text-ink-faint">Free and open source. Runs on your computer.</p>
      </div>
      <div className="w-full">
        <LiveDemo />
      </div>
    </section>
  );
}

export function AgentsStrip() {
  return (
    <section aria-labelledby="agents-heading" className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
      <div className="flex flex-col items-center gap-6 border-y border-line py-10">
        <h2 id="agents-heading" className="text-meta text-ink-muted">
          Works with the agents you already use
        </h2>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {agents.map((agent) => (
            <li key={agent.kind} className="flex items-center gap-2.5">
              <AgentMark kind={agent.kind} size={24} className="text-ink" />
              <span className="text-meta font-medium text-ink">{agent.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
