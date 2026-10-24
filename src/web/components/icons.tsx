// A handful of 1.5px-stroke icons, drawn inline so nothing else needs installing.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconFrame({ size = 16, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function MicrophoneIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </IconFrame>
  );
}

export function SpeakerIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 9.5h3l4.5-4v13L7 14.5H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </IconFrame>
  );
}

export function SpeakerQuietIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 9.5h3l4.5-4v13L7 14.5H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6" />
    </IconFrame>
  );
}

export function SpeakerMutedIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 9.5h3l4.5-4v13L7 14.5H4z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </IconFrame>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconFrame>
  );
}

export function ExpandIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" />
    </IconFrame>
  );
}

export function KeyboardIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </IconFrame>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconFrame>
  );
}
