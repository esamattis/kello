import { ComponentChildren } from "preact";

interface SettingsCardProps {
    children: ComponentChildren;
    class?: string;
}

export function SettingsCard({ children, class: cls }: SettingsCardProps) {
    return (
        <div
            class={`settings-card rounded-2xl px-5 py-4 flex flex-col gap-3 ${cls ?? ""}`}
        >
            {children}
        </div>
    );
}

interface SettingsRowProps {
    label: string;
    children: ComponentChildren;
    muted?: boolean;
}

export function SettingsRow({ label, children, muted }: SettingsRowProps) {
    return (
        <div class="flex items-center justify-between gap-4">
            <span
                class={`text-sm ${muted ? "themed-subtle-text" : "themed-muted-text"}`}
            >
                {label}
            </span>
            <div class="flex items-center gap-2">{children}</div>
        </div>
    );
}

interface CheckboxRowProps {
    id: string;
    label: string;
    checked: boolean;
    onChange: () => void;
    children?: ComponentChildren;
}

export function CheckboxRow({
    id,
    label,
    checked,
    onChange,
    children,
}: CheckboxRowProps) {
    return (
        <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
                <input
                    type="checkbox"
                    id={id}
                    checked={checked}
                    onChange={onChange}
                    class="w-4 h-4 accent-blue-500"
                />
                <label
                    for={id}
                    class="text-sm themed-muted-text cursor-pointer select-none"
                >
                    {label}
                </label>
            </div>
            {checked && children && (
                <div class="ml-6 flex flex-col gap-2">{children}</div>
            )}
        </div>
    );
}
