// The two surfaces that are not pressed: a sheet is read, a tray holds things and sits in.

import type { HTMLAttributes, ReactNode } from "react";

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Sheet({ className = "", children, ...rest }: SurfaceProps) {
  return (
    <div className={`rounded-outer border border-line bg-raised ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Tray({ className = "", children, ...rest }: SurfaceProps) {
  return (
    <div className={`rounded-inner border border-line bg-tray shadow-tray ${className}`} {...rest}>
      {children}
    </div>
  );
}
