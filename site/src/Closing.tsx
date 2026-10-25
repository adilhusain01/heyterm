// The end of the page: what keeps it safe, how to start, and where it lives.

import { CopyCommand, Section, SectionHeading } from "./pieces.tsx";
import { links } from "./Top.tsx";

const promises: Array<{ title: string; text: string }> = [
  { title: "No gates of its own", text: "HeyTerm follows each agent's own permission mode. What the agent allows, runs; what the agent asks about comes to you." },
  { title: "Only this computer", text: "It listens on 127.0.0.1 alone, and every page and hook needs a private token only your user can read." },
  { title: "Other sites cannot drive it", text: "Requests from other origins, cross-site fetches and rebinding tricks are refused, and the page cannot be framed." },
  { title: "Every decision on record", text: "Each approval or answer, by voice or by click, is written to a local log with the words that decided it." },
];

export function Safety() {
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <SectionHeading title="It types into your terminals, so it answers only you.">
          <p>HeyTerm runs on your computer, on the agent logins you already have. There is no account and no server of ours in the middle.</p>
        </SectionHeading>
        <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {promises.map((promise) => (
            <li key={promise.title} className="flex flex-col gap-2 border-t border-line-strong pt-5">
              <h3 className="text-title font-medium text-ink">{promise.title}</h3>
              <p className="text-body leading-relaxed text-ink-muted">{promise.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export function GetStarted() {
  return (
    <Section id="start">
      <div className="flex flex-col gap-10 rounded-outer border border-line bg-panel p-6 sm:p-10">
        <SectionHeading title="Start in a minute.">
          <p>You need Node.js 20 or newer and one coding agent you have signed in to once. Then:</p>
        </SectionHeading>
        <ol className="flex flex-col gap-5">
          <li className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-5">
            <span className="w-56 shrink-0 text-body text-ink">Check what is installed</span>
            <CopyCommand command="npx heyterm doctor" />
          </li>
          <li className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-5">
            <span className="w-56 shrink-0 text-body text-ink">Start it and open the page</span>
            <CopyCommand command="npx heyterm" />
          </li>
          <li className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-5">
            <span className="w-56 shrink-0 text-body text-ink">Hold your dictation key and say</span>
            <span className="w-fit rounded-inner bg-raised px-3 py-2 text-body text-ink">"start a session in" and a project's name</span>
          </li>
        </ol>
        <p className="text-small text-ink-faint">
          Use headphones, so HeyTerm's spoken lines never end up in your own dictation. To remove it, run <span className="font-mono text-ink-muted">npx heyterm uninstall</span>.
        </p>
      </div>
    </Section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pt-6 pb-14 sm:px-6 md:flex-row md:items-center">
      <div className="flex items-center gap-2.5">
        <img src="/favicon.svg" alt="" width={22} height={22} />
        <span className="text-meta text-ink-muted">HeyTerm is free and open source under the MIT licence.</span>
      </div>
      <nav aria-label="Elsewhere" className="flex flex-wrap gap-x-5 gap-y-2 md:ml-auto">
        <a href={links.github} className="text-meta text-ink-muted underline decoration-line-strong underline-offset-4 transition-[color,text-decoration-color] duration-150 hover:text-ink hover:decoration-ink-muted">
          Source on GitHub
        </a>
        <a href={links.npm} className="text-meta text-ink-muted underline decoration-line-strong underline-offset-4 transition-[color,text-decoration-color] duration-150 hover:text-ink hover:decoration-ink-muted">
          Package on npm
        </a>
        <a href={links.playground} className="text-meta text-ink-muted underline decoration-line-strong underline-offset-4 transition-[color,text-decoration-color] duration-150 hover:text-ink hover:decoration-ink-muted">
          Playground
        </a>
        <a href="https://www.wemakedevs.org/wispr" className="text-meta text-ink-muted underline decoration-line-strong underline-offset-4 transition-[color,text-decoration-color] duration-150 hover:text-ink hover:decoration-ink-muted">
          Built for No Hands, the Wispr challenge
        </a>
      </nav>
    </footer>
  );
}
