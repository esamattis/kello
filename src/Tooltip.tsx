import { ComponentChildren } from "preact";
import { useRef, useEffect, useMemo } from "preact/hooks";

interface TooltipProps {
    content: string;
    children: ComponentChildren;
    position?: "top" | "bottom" | "left" | "right";
    class?: string;
}

export function Tooltip({
    content,
    children,
    position = "top",
    class: className = "",
}: TooltipProps) {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const popoverId = useMemo(
        () => `tooltip-${Math.random().toString(36).substring(7)}`,
        [],
    );

    useEffect(() => {
        const trigger = triggerRef.current;
        const popover = popoverRef.current;

        if (!trigger || !popover) return;

        const showTooltip = () => {
            popover.showPopover();
            updatePosition();
        };

        const hideTooltip = () => {
            popover.hidePopover();
        };

        const updatePosition = () => {
            if (!trigger || !popover) return;

            const triggerRect = trigger.getBoundingClientRect();
            const popoverRect = popover.getBoundingClientRect();

            let top = 0;
            let left = 0;

            switch (position) {
                case "top":
                    top = triggerRect.top - popoverRect.height - 8;
                    left =
                        triggerRect.left +
                        triggerRect.width / 2 -
                        popoverRect.width / 2;
                    break;
                case "bottom":
                    top = triggerRect.bottom + 8;
                    left =
                        triggerRect.left +
                        triggerRect.width / 2 -
                        popoverRect.width / 2;
                    break;
                case "left":
                    top =
                        triggerRect.top +
                        triggerRect.height / 2 -
                        popoverRect.height / 2;
                    left = triggerRect.left - popoverRect.width - 8;
                    break;
                case "right":
                    top =
                        triggerRect.top +
                        triggerRect.height / 2 -
                        popoverRect.height / 2;
                    left = triggerRect.right + 8;
                    break;
            }

            popover.style.top = `${top}px`;
            popover.style.left = `${left}px`;
        };

        trigger.addEventListener("mouseenter", showTooltip);
        trigger.addEventListener("mouseleave", hideTooltip);
        trigger.addEventListener("focus", showTooltip);
        trigger.addEventListener("blur", hideTooltip);

        return () => {
            trigger.removeEventListener("mouseenter", showTooltip);
            trigger.removeEventListener("mouseleave", hideTooltip);
            trigger.removeEventListener("focus", showTooltip);
            trigger.removeEventListener("blur", hideTooltip);
        };
    }, [position]);

    return (
        <>
            <span
                ref={triggerRef}
                class={`inline-flex ${className}`}
                aria-describedby={popoverId}
            >
                {children}
            </span>
            <div
                ref={popoverRef}
                id={popoverId}
                popover="manual"
                class="fixed m-0 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg pointer-events-none z-50 opacity-0 transition-opacity duration-200 [&:popover-open]:opacity-100"
            >
                {content}
            </div>
        </>
    );
}
