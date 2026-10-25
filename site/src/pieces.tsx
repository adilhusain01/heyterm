// Small pieces the page uses in more than one section.

import { useState, type ReactNode } from "react";
import { CheckIcon, MoonIcon, SunIcon } from "../../src/web/ui/icons.tsx";

// A command with a key that copies it. The copy icon turns into a check, cross-faded, then back.
export function CopyCommand({ command, size = "regular" }: { command: string; size?: "regular" | "large" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  const height = size === "large" ? "h-12 text-body" : "h-10 text-meta";
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `Copied ${command}` : `Copy ${command}`}
      className={`press key-lift group inline-flex ${height} cursor-pointer items-center gap-3 rounded-inner border border-line-strong bg-key pr-3 pl-4 font-mono text-ink shadow-key hover:bg-key-hover`}
    >
      <span className="text-ink-faint select-none">$</span>
      <span>{command}</span>
      <span className="relative ml-1 grid size-5 place-items-center text-ink-muted">
        <CopyGlyph className={`col-start-1 row-start-1 transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${copied ? "scale-25 opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-[0px]"}`} />
        <CheckIcon size={16} className={`col-start-1 row-start-1 text-finished transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${copied ? "scale-100 opacity-100 blur-[0px]" : "scale-25 opacity-0 blur-[4px]"}`} />
      </span>
    </button>
  );
}

function CopyGlyph({ className }: { className: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

// Light or dark. A theme switch changes every colour at once; with transitions on, the page would
// smear through them, so they are paused for the swap.
export function ThemeToggle() {
  const [theme, setTheme] = useState(() => (typeof document !== "undefined" ? document.documentElement.dataset.theme : "light") ?? "light");
  const next = theme === "dark" ? "light" : "dark";
  const toggle = () => {
    const pause = document.createElement("style");
    pause.textContent = "*,*::before,*::after{transition:none !important}";
    document.head.appendChild(pause);
    document.documentElement.dataset.theme = next;
    void document.documentElement.offsetHeight;
    requestAnimationFrame(() => pause.remove());
    try {
      localStorage.setItem("heyterm.site.theme", next);
    } catch {
      // Not saving only means the next visit follows the system.
    }
    setTheme(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to the ${next} theme`}
      title={`Switch to the ${next} theme`}
      className="press grid size-9 cursor-pointer place-items-center rounded-inner text-ink-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
    >
      {theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
    </button>
  );
}

export function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex max-w-[62ch] flex-col gap-4">
      <h2 className="display text-section text-ink">{title}</h2>
      {children && <div className="lede flex flex-col gap-3 text-lede text-ink-muted">{children}</div>}
    </div>
  );
}

// Every section shares one width, so their left edges line up; text keeps its own reading width inside.
export function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto w-full max-w-[1280px] px-4 py-16 sm:px-6 md:py-24 ${className}`}>
      {children}
    </section>
  );
}

// A line the user says, set like the bubble the app draws for it.
export function SaidLine({ children }: { children: ReactNode }) {
  return <span className="w-fit rounded-inner bg-raised px-3 py-1.5 text-body text-ink">"{children}"</span>;
}
