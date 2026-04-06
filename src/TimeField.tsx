interface TimeFieldProps {
    id: string;
    label: string;
    value: string;
    onInput: (e: Event) => void;
    containerClass?: string;
    labelClass?: string;
    inputClass?: string;
}

export function TimeField({
    id,
    label,
    value,
    onInput,
    containerClass = "flex items-center gap-2",
    labelClass = "themed-muted-text",
    inputClass = "themed-field w-28 pl-2 pr-7 py-1 rounded text-sm",
}: TimeFieldProps) {
    return (
        <div class={containerClass}>
            <label for={id} class={labelClass}>
                {label}
            </label>
            <div class="relative">
                <input
                    id={id}
                    type="time"
                    value={value}
                    onInput={onInput}
                    class={inputClass}
                />
            </div>
        </div>
    );
}
