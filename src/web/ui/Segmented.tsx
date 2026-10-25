// A choice of a few options, one always picked: a tray with the picked option as a raised key.
// The tray's radius is the key's plus its 2px padding, so the corners nest.

import type { ReactNode } from "react";

interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
  icon?: ReactNode;
}

interface SegmentedProps<Value extends string> {
  label: string;
  value: Value;
  options: SegmentedOption<Value>[];
  onChange: (value: Value) => void;
  stretch?: boolean;
}

export function Segmented<Value extends string>({ label, value, options, onChange, stretch = false }: SegmentedProps<Value>) {
  return (
    <div role="radiogroup" aria-label={label} className={`${stretch ? "flex" : "inline-flex self-start"} gap-0.5 rounded-inner border border-line bg-tray p-0.5 shadow-tray`}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`press inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-small px-2.5 text-meta transition-[background-color,color,box-shadow] duration-150 ${stretch ? "flex-1" : ""} ${selected ? "bg-key text-ink shadow-key" : "text-ink-muted hover:text-ink"}`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
