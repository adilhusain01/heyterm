// A command, path or message in a tray, folded to a few lines with a key to read it all.

import { useState } from "react";
import { Tray } from "./Surfaces.tsx";

export function FoldedText({ text, lines = 4, mono = true }: { text: string; lines?: number; mono?: boolean }) {
  const [isOpen, setOpen] = useState(false);
  const lineCount = text.split("\n").length;
  const isLong = lineCount > lines || text.length > lines * 48;
  return (
    <Tray className="flex flex-col">
      {/* The padding sits outside the clamped element, so no part of a hidden line shows through. */}
      <div className="px-2.5 py-2">
        <pre
          className={`overflow-hidden whitespace-pre-wrap break-words text-ink ${mono ? "font-mono text-small leading-relaxed" : "font-sans text-meta"}`}
          style={isOpen || !isLong ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical" }}
        >
          {text}
        </pre>
      </div>
      {isLong && (
        <button type="button" onClick={() => setOpen(!isOpen)} className="cursor-pointer border-t border-line px-2.5 py-1 text-left text-meta text-ink-muted transition-colors duration-150 hover:text-ink">
          {isOpen ? "Show less" : `Show all ${lineCount > 1 ? `${lineCount} lines` : ""}`.trim()}
        </button>
      )}
    </Tray>
  );
}
