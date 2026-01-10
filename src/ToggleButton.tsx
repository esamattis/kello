import { ComponentChildren } from "preact";

interface ToggleButtonProps {
    children: ComponentChildren;
    checked: boolean;
    checkbox?: boolean;
    checkedChildren?: ComponentChildren;
    onChange?: () => void;
    checkedClass?: string;
    uncheckedClass?: string;
}

export function ToggleButton({
    children,
    checked,
    checkbox = false,
    checkedChildren,
    onChange,
    checkedClass = "bg-blue-500 text-white hover:bg-blue-600",
    uncheckedClass = "bg-gray-200 text-gray-700 hover:bg-gray-300",
}: ToggleButtonProps) {
    const displayContent = checked && checkedChildren ? checkedChildren : children;

    if (checkbox) {
        return (
            <label
                class={`w-full px-4 py-4 rounded-full text-sm font-medium transition-colors flex items-center justify-center cursor-pointer ${
                    checked ? checkedClass : uncheckedClass
                }`}
            >
                <span class="w-44 flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={onChange}
                        class="w-4 h-4 accent-white"
                    />
                    <span>{displayContent}</span>
                </span>
            </label>
        );
    }

    return (
        <button
            onClick={onChange}
            class={`w-full px-4 py-4 rounded-full text-sm font-medium transition-colors ${
                checked ? checkedClass : uncheckedClass
            }`}
        >
            {displayContent}
        </button>
    );
}
