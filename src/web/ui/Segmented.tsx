// A choice of a few options, one always picked: a tray with the picked option as a raised key.
// The tray's radius is the key's plus its 2px padding, so the corners nest. With columns, the keys
// sit in a grid of that many columns, for more choices than fit in one row of a narrow column.

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
  columns?: number;
}

export function Segmented<Value extends string>({ label, value, options, onChange, stretch = false, columns }: SegmentedProps<Value>) {
  const layout = columns ? "grid" : stretch ? "flex" : "inline-flex self-start";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${layout} min-w-0 gap-0.5 rounded-inner border border-line bg-tray p-0.5 shadow-tray`}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            title={option.label}
            className={`press inline-flex h-7 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-small px-2 text-meta whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 ${stretch ? "flex-1" : ""} ${selected ? "bg-key text-ink shadow-key" : "text-ink-muted hover:text-ink"}`}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
