// A pressable key. It casts a shadow because it can be pressed; see docs/DESIGN.md.

import type { ButtonHTMLAttributes, ReactNode } from "react";

type KeyTone = "primary" | "plain" | "quiet";
type KeySize = "small" | "regular";

interface KeyProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: KeyTone;
  size?: KeySize;
  children: ReactNode;
}

const toneClass: Record<KeyTone, string> = {
  primary: "key-lift bg-ink text-canvas shadow-key hover:bg-white",
  plain: "key-lift border border-line bg-key text-ink shadow-key hover:bg-key-hover",
  // For rows inside a list: no shadow, a fill on hover.
  quiet: "text-ink-muted hover:bg-raised hover:text-ink",
};

const sizeClass: Record<KeySize, string> = {
  small: "h-7 px-2.5 text-meta",
  regular: "h-8 px-3 text-meta",
};

export function Key({ tone = "plain", size = "regular", className = "", children, type = "button", ...rest }: KeyProps) {
  return (
    <button type={type} className={`press inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-inner font-medium ${sizeClass[size]} ${toneClass[tone]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
