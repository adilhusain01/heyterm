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
    <header className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-4 pt-5 sm:px-6">
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
    <section className="mx-auto flex w-full max-w-[1180px] flex-col gap-12 px-4 pt-16 pb-10 sm:px-6 md:pt-24">
      <div className="flex max-w-[860px] flex-col gap-6">
        <h1 className="display text-hero text-ink">Run every coding agent in one window, by voice.</h1>
        <p className="lede max-w-[60ch] text-lede text-ink-muted">
          HeyTerm is a harness for your harnesses. Claude Code, Codex, Gemini CLI, Grok Build and Cursor run side by side, and you talk to them through Wispr Flow or any
          dictation tool. It sends your words to the right agent and tells you when one is waiting on you.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <CopyCommand command="npx heyterm" size="large" />
          <a
            href={links.playground}
            className="press key-lift inline-flex h-12 items-center rounded-inner bg-primary px-5 text-body font-medium text-primary-ink shadow-key hover:bg-primary-hover"
          >
            Try the playground
          </a>
        </div>
        <p className="text-small text-ink-faint">Free and open source under MIT. It runs on your computer, on the agent logins you already have.</p>
      </div>
      <LiveDemo />
    </section>
  );
}

export function AgentsStrip() {
  return (
    <section aria-labelledby="agents-heading" className="mx-auto w-full max-w-[1180px] px-4 sm:px-6">
      <div className="flex flex-col gap-6 border-y border-line py-10 md:flex-row md:items-center md:gap-10">
        <h2 id="agents-heading" className="shrink-0 text-meta text-ink-muted md:w-48">
          The agents it runs, each in its own terminal
        </h2>
        <div className="flex flex-1 flex-col gap-6">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          {agents.map((agent) => (
            <li key={agent.kind} className="flex items-center gap-3">
              <AgentMark kind={agent.kind} size={26} className="text-ink" />
              <span className="flex flex-col">
                <span className="text-meta font-medium text-ink">{agent.name}</span>
                <span className="font-mono text-micro text-ink-faint">{agent.command}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-meta text-ink-muted">
          You talk through <a href="https://wisprflow.ai" className="text-ink underline decoration-line-strong underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-ink-muted">Wispr Flow</a>, macOS
          Dictation or any tool that types what you say. Typing works too.
        </p>
        </div>
      </div>
    </section>
  );
}
