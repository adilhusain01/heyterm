// What to say out loud.

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-meta text-ink-faint">{children}</p>;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-mark border border-line bg-tray px-1.5 py-0.5 font-mono text-small text-ink-faint">{children}</kbd>;
}
