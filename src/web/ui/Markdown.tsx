// What agents write, rendered from Markdown. react-markdown never renders raw HTML, so nothing an
// agent writes can run in this page, which can type into terminals.

import ReactMarkdown, { type Components } from "react-markdown";

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => <code className="rounded-tiny bg-raised px-1 py-px font-mono text-[0.88em] text-ink">{children}</code>,
  pre: ({ children }) => <pre className="mb-2 overflow-x-auto rounded-inner border border-line bg-tray p-2.5 font-mono text-small [&_code]:bg-transparent [&_code]:p-0">{children}</pre>,
  ul: ({ children }) => <ul className="mb-2 flex list-disc flex-col gap-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 flex list-decimal flex-col gap-1 pl-5 last:mb-0">{children}</ol>,
  h1: ({ children }) => <p className="mt-3 mb-1.5 font-semibold text-accent-ink first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="mt-3 mb-1.5 font-semibold text-accent-ink first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="mt-3 mb-1.5 font-semibold text-accent-ink first:mt-0">{children}</p>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline decoration-accent/40 underline-offset-2 transition-[text-decoration-color] duration-150 hover:decoration-accent">
      {children}
    </a>
  ),
};

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`break-words ${className}`}>
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
}
