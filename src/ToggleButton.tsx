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
    uncheckedClass = "toggle-unchecked",
}: ToggleButtonProps) {
    const displayContent =
        checked && checkedChildren ? checkedChildren : children;
    const baseClass =
        "w-full px-4 py-4 rounded-full text-sm font-medium transition-colors";

    if (checkbox) {
        return (
            <label
                class={`${baseClass} flex items-center justify-center cursor-pointer ${
                    checked ? checkedClass : uncheckedClass
                }`}
            >
                <span class="w-44 flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={onChange}
                        class={`w-4 h-4 appearance-none border-2 rounded ${
                            checked
                                ? "bg-white border-white"
                                : "bg-white border-gray-400"
                        }`}
                        style={
                            checked
                                ? {
                                      backgroundImage:
                                          "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='%233b82f6' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")",
                                      backgroundSize: "100% 100%",
                                      backgroundPosition: "center",
                                      backgroundRepeat: "no-repeat",
                                  }
                                : undefined
                        }
                    />
                    <span>{displayContent}</span>
                </span>
            </label>
        );
    }

    return (
        <button
            onClick={onChange}
            class={`${baseClass} ${checked ? checkedClass : uncheckedClass}`}
        >
            {displayContent}
        </button>
    );
}
