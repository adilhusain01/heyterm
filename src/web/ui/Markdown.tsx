// What agents write, rendered from Markdown. react-markdown never renders raw HTML, so nothing an
// agent writes can run in this page, which can type into terminals.

import { useRef, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { CopyButton } from "./CopyButton.tsx";

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => <code className="rounded-tiny bg-raised px-1 py-px font-mono text-[0.88em] text-ink">{children}</code>,
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
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

// A command wraps to show all of it, since the column is narrow, and copies with its button.
function CodeBlock({ children }: { children?: ReactNode }) {
  const blockRef = useRef<HTMLPreElement>(null);
  return (
    <div className="relative mb-2">
      <pre ref={blockRef} className="rounded-inner border border-line bg-tray py-2.5 pr-9 pl-2.5 font-mono text-small break-words whitespace-pre-wrap [overflow-wrap:anywhere] [&_code]:bg-transparent [&_code]:p-0">
        {children}
      </pre>
      <CopyButton text={() => (blockRef.current?.textContent ?? "").replace(/\n$/, "")} className="absolute top-1 right-1" />
    </div>
  );
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`break-words ${className}`}>
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
}
