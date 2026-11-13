import { ComponentChildren } from "preact";

interface IconProps {
    class?: string;
}

function Icon({
    class: cls = "",
    children,
}: IconProps & { children: ComponentChildren }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            class={`inline-block h-[1.1em] w-[1.1em] shrink-0 align-[-0.2em] ${cls}`}
        >
            {children}
        </svg>
    );
}

export function AlarmClockIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2 2" />
            <path d="M5 3 2 6" />
            <path d="m22 6-3-3" />
            <path d="M6.38 18.7 4 21" />
            <path d="M17.64 18.67 20 21" />
        </Icon>
    );
}

export function BellIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </Icon>
    );
}

export function VolumeIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </Icon>
    );
}

export function SunIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
        </Icon>
    );
}

export function MoonIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
        </Icon>
    );
}

export function MaximizeIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </Icon>
    );
}

export function MinimizeIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </Icon>
    );
}
