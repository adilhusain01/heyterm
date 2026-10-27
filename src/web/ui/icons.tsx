// Lucide icons (ISC licence), fetched with better-icons from Iconify and kept here as source, so
// nothing is installed for them. One stroke style everywhere: 1.75px, round caps.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconFrame({ size = 16, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}


export function PanelLeftCloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18m7-6l-3-3l3-3" />
    </IconFrame>
  );
}

export function PanelLeftOpenIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18m5-12l3 3l-3 3" />
    </IconFrame>
  );
}

export function PanelRightCloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M15 3v18M8 9l3 3l-3 3" />
    </IconFrame>
  );
}

export function PanelRightOpenIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M15 3v18m-5-6l-3-3l3-3" />
    </IconFrame>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </IconFrame>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01" />
    </IconFrame>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14m-7-7v14" />
    </IconFrame>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M3 12a9 9 0 1 0 9-9a9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5m4-1v5l4 2" />
    </IconFrame>
  );
}

export function SpeakerIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM16 9a5 5 0 0 1 0 6m3.364 3.364a9 9 0 0 0 0-12.728" />
    </IconFrame>
  );
}

export function SpeakerQuietIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM16 9a5 5 0 0 1 0 6" />
    </IconFrame>
  );
}

export function SpeakerMutedIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298zm5.5 9.798l5-5m-5 0l5 5" />
    </IconFrame>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </IconFrame>
  );
}

export function FocusIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect width="18" height="18" x="3" y="3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" rx="2" />
    </IconFrame>
  );
}

export function ExpandIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 3h6v6m0-6l-7 7M3 21l7-7m-1 7H3v-6" />
    </IconFrame>
  );
}

export function ShrinkIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m14 10l7-7m-1 7h-6V4M3 21l7-7m-6 0h6v6" />
    </IconFrame>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 6L6 18M6 6l12 12" />
    </IconFrame>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4" />
    </IconFrame>
  );
}

export function KeyboardIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10m-9-4h.01" />
      <rect width="20" height="16" x="2" y="4" rx="2" />
    </IconFrame>
  );
}

export function PowerIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v10m6.4-5.4a9 9 0 1 1-12.77.04" />
    </IconFrame>
  );
}

export function BringBackIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M3 12a9 9 0 1 0 9-9a9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </IconFrame>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m21 21l-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </IconFrame>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M20 6L9 17l-5-5" />
    </IconFrame>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </IconFrame>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </IconFrame>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 5v14m7-7l-7 7l-7-7" />
    </IconFrame>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </IconFrame>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3a6 6 0 0 0 9 9a9 9 0 1 1-9-9" />
    </IconFrame>
  );
}
