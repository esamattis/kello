import { ComponentChildren } from "preact";

interface SwitchProps {
    checked: boolean;
    onChange: () => void;
    label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={onChange}
            class={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${
                checked ? "bg-orange-500" : "switch-off"
            }`}
        >
            <span
                class={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    checked ? "translate-x-7" : "translate-x-1"
                }`}
            />
        </button>
    );
}

export function Card({ children }: { children: ComponentChildren }) {
    return (
        <div class="settings-card rounded-2xl p-5 flex flex-col gap-4">
            {children}
        </div>
    );
}

interface CardHeaderProps {
    icon: ComponentChildren;
    title: string;
    status: string;
    active: boolean;
    switchLabel: string;
    onToggle: () => void;
}

/** Card title with an icon, a one-line status and the card's master switch. */
export function CardHeader({
    icon,
    title,
    status,
    active,
    switchLabel,
    onToggle,
}: CardHeaderProps) {
    return (
        <div class="flex items-center justify-between gap-4">
            <div class="flex flex-col">
                <h2 class="text-base font-semibold inline-flex items-center gap-2">
                    {icon}
                    {title}
                </h2>
                <span
                    class={`text-sm ${
                        active
                            ? "text-orange-500 font-medium"
                            : "themed-subtle-text"
                    }`}
                >
                    {status}
                </span>
            </div>
            <Switch checked={active} onChange={onToggle} label={switchLabel} />
        </div>
    );
}

export function Section({
    title,
    children,
}: {
    title: string;
    children: ComponentChildren;
}) {
    return (
        <div class="flex flex-col gap-2 pt-4 border-t border-[var(--border-subtle)]">
            <h3 class="text-xs font-semibold uppercase tracking-wide themed-subtle-text">
                {title}
            </h3>
            {children}
        </div>
    );
}

/** Text on the left, switch on the right. */
export function SwitchRow({
    text,
    checked,
    onChange,
    label,
}: SwitchProps & { text: string }) {
    return (
        <div class="flex items-center justify-between gap-4">
            <span class="text-sm themed-muted-text">{text}</span>
            <Switch checked={checked} onChange={onChange} label={label} />
        </div>
    );
}

export function formatTime(hours: number, minutes: number) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Hour on a 12-hour dial: 0 is shown as 12. */
export function dialHour(hours: number) {
    const h = ((hours % 12) + 12) % 12;
    return h === 0 ? 12 : h;
}

/** 12-hour time without AM/PM, e.g. "08:30" or "12:15". */
export function formatDialTime(hours: number, minutes: number) {
    return formatTime(dialHour(hours), minutes);
}

// 12 first so the list reads like the clock face
const HOUR_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_STEP = 5;
const MINUTE_OPTIONS = Array.from(
    { length: 60 / MINUTE_STEP },
    (_, i) => i * MINUTE_STEP,
);

/**
 * Minutes in 5 minute steps. A current value off the grid (e.g. set by a
 * quick shortcut) is included so the select can still show it.
 */
function minuteOptions(current: number) {
    if (MINUTE_OPTIONS.includes(current)) {
        return MINUTE_OPTIONS;
    }
    return [...MINUTE_OPTIONS, current].sort((a, b) => a - b);
}

interface TimePickerProps {
    label: string;
    /** Hours 0-11 (values 12-23 are treated as the same dial position) */
    hours: number;
    minutes: number;
    /** Called with hours 0-11 and minutes 0-59 */
    onChange: (hours: number, minutes: number) => void;
    dimmed?: boolean;
}

/**
 * Large 12-hour time picker without AM/PM, matching the analog clock face.
 * Uses native selects so phones show their own wheel pickers.
 */
export function TimePicker({
    label,
    hours,
    minutes,
    onChange,
    dimmed = false,
}: TimePickerProps) {
    const hours12 = ((hours % 12) + 12) % 12;
    const selectClass =
        "time-picker-select appearance-none bg-transparent text-5xl font-mono font-bold tabular-nums text-center rounded-lg px-1 outline-none cursor-pointer focus-visible:outline-2 focus-visible:outline-orange-500";

    return (
        <div
            role="group"
            aria-label={label}
            class={`time-picker-shell flex items-center justify-center rounded-xl py-2 transition-opacity ${
                dimmed ? "opacity-50" : ""
            }`}
        >
            <select
                aria-label={`${label}, tunnit`}
                value={hours12}
                onInput={(e) =>
                    onChange(Number(e.currentTarget.value), minutes)
                }
                class={selectClass}
            >
                {HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                        {String(dialHour(h)).padStart(2, "0")}
                    </option>
                ))}
            </select>
            <span class="text-5xl font-mono font-bold" aria-hidden="true">
                :
            </span>
            <select
                aria-label={`${label}, minuutit`}
                value={minutes}
                onInput={(e) =>
                    onChange(hours12, Number(e.currentTarget.value))
                }
                class={selectClass}
            >
                {minuteOptions(minutes).map((m) => (
                    <option key={m} value={m}>
                        {String(m).padStart(2, "0")}
                    </option>
                ))}
            </select>
        </div>
    );
}
