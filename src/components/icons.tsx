import { useId, type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** The padel ball that stands for the club throughout the app. */
export function BallIcon({ size = 20, ...rest }: IconProps) {
  const id = useId();
  const fillId = `${id}-fill`;
  const clipId = `${id}-clip`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      <defs>
        <radialGradient id={fillId} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#f3ffa6" />
          <stop offset="0.55" stopColor="#d6ff3f" />
          <stop offset="1" stopColor="#9ccc17" />
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx="12" cy="12" r="10" />
        </clipPath>
      </defs>
      <circle cx="12" cy="12" r="10" fill={`url(#${fillId})`} />
      <g clipPath={`url(#${clipId})`} fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.3" strokeLinecap="round">
        <path d="M5.8 2.5c5 4.8 5 14.2 0 19" />
        <path d="M18.2 2.5c-5 4.8-5 14.2 0 19" />
      </g>
    </svg>
  );
}

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 6.3" />
    <path d="M20 4v7h-7" />
  </Svg>
);

export const LocateIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    <circle cx="12" cy="12" r="7.5" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.800 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.4" />
  </Svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.500 4.500 4.500L19 7.500" />
  </Svg>
);

export const NavigateIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 3 10.500 13.500" />
    <path d="M21 3 14.500 21l-4-7.500L3 9.500 21 3z" />
  </Svg>
);

export const JamIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 16v-3.200l1.600-4A2 2 0 0 1 8.460 7.500h7.080a2 2 0 0 1 1.860 1.300l1.600 4V16" />
    <path d="M4 16h16v2.500H4z" />
    <path d="M7.500 13.200h.01M16.500 13.200h.01" />
  </Svg>
);

export const ConeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.300 4h3.400l4.300 14H6L10.300 4z" />
    <path d="M4 20h16M8.500 10h7M7.300 14h9.400" />
  </Svg>
);

export const ClosedIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M7.500 12h9" />
  </Svg>
);

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 2.800 19.500h18.400L12 4z" />
    <path d="M12 10v4.500M12 17.200h.01" />
  </Svg>
);

export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.500M12 7.800h.01" />
  </Svg>
);

export const OfflineIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M5 12.500a10 10 0 0 1 4.300-2.700M2 8.800a15 15 0 0 1 4.500-2.900M10.600 5.200A15 15 0 0 1 22 8.800M14.700 9.800A10 10 0 0 1 19 12.500M8.500 16a5 5 0 0 1 7 0" />
    <path d="M12 19.500h.01" />
  </Svg>
);

export const InstallIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v11M7.500 10.500 12 15l4.500-4.500M5 19.500h14" />
  </Svg>
);

export const MinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 12h12" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 6v12M6 12h12" />
  </Svg>
);
