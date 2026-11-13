import { Signal } from "@preact/signals";
import { ComponentChildren } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import {
    alarmEnabled,
    alarmTimeFormatted,
    computeTimeToNextAlarm,
} from "./alarm";
import { BellIcon } from "./icons";

const pad = (n: number) => String(n).padStart(2, "0");

interface BadgeProps {
    currentTime: Signal<Date>;
}

/** Digital time: large hours and minutes with small seconds. */
export function DigitalClockBadge({ currentTime }: BadgeProps) {
    const now = currentTime.value;

    return (
        <div
            class="clock-badge"
            role="timer"
            aria-label="Kellonaika"
            data-testid="digital-clock"
        >
            <div class="clock-badge-time">
                <span>
                    {pad(now.getHours())}:{pad(now.getMinutes())}
                </span>
                <span class="clock-badge-small">{pad(now.getSeconds())}</span>
            </div>
        </div>
    );
}

/** Alarm time with a countdown, styled like the digital clock. */
export function AlarmBadge({ currentTime }: BadgeProps) {
    const countdown = computeTimeToNextAlarm(currentTime).value;

    if (!alarmEnabled.value || !countdown) {
        return null;
    }

    return (
        <div
            class="clock-badge clock-badge-alarm"
            title="Hälytys on käytössä"
            data-testid="alarm-badge"
        >
            <div class="clock-badge-time">
                <BellIcon class="clock-badge-icon" />
                <span aria-label="Hälytysaika">{alarmTimeFormatted.value}</span>
            </div>
            <div class="clock-badge-small" aria-label="Aikaa herätykseen">
                {countdown.hours}:{pad(countdown.minutes)}:
                {pad(countdown.seconds)}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Layout

/** Badge size per 1px of font size, measured from the rendered badge. */
interface Ratio {
    w: number;
    h: number;
}

interface Placement {
    fontSize: number;
    left: number;
    top: number;
}

type Slot = "start" | "end";

/** Outer radius of the face ring as a fraction of the face size. */
const FACE_RADIUS = 0.49;
/**
 * Strips beside the face are preferred; corners are only used when they allow
 * a clearly bigger badge (i.e. on square-ish windows).
 */
const CORNER_ADVANTAGE = 1.4;
/** Badges in the strips don't fill the strip completely. */
const STRIP_SCALE = 0.75;
const MAX_FONT = 260;

/**
 * Largest font size for a badge pushed into a corner of the stage without
 * touching the clock face circle. `right` picks the top-right corner.
 */
function cornerFont(
    width: number,
    height: number,
    ratio: Ratio,
    margin: number,
    right: boolean,
) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * FACE_RADIUS + margin;

    const fits = (font: number) => {
        const w = ratio.w * font;
        const h = ratio.h * font;
        if (w + 2 * margin > width || h + 2 * margin > height) return false;
        const x0 = right ? width - margin - w : margin;
        const x1 = x0 + w;
        const y0 = margin;
        const y1 = y0 + h;
        // Closest point of the badge to the face center
        const px = Math.min(Math.max(cx, x0), x1);
        const py = Math.min(Math.max(cy, y0), y1);
        return Math.hypot(px - cx, py - cy) >= radius;
    };

    let lo = 0;
    let hi = MAX_FONT;
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
    }
    return lo;
}

interface Fit {
    strip: number;
    corner: number;
}

/** Largest font for a badge in the strip next to the face and in a corner. */
function fitBadge(
    width: number,
    height: number,
    ratio: Ratio,
    slot: Slot,
): Fit {
    const face = Math.min(width, height);
    const margin = badgeMargin(width, height);
    const landscape = width >= height;
    const strip = (Math.max(width, height) - face) / 2;

    // Strip: left/right of the face in landscape, above/below in portrait
    const stripW = landscape ? strip : width;
    const stripH = landscape ? height : strip;
    return {
        strip: Math.max(
            0,
            Math.min(
                (stripW - 2 * margin) / ratio.w,
                (stripH - 2 * margin) / ratio.h,
                MAX_FONT,
            ),
        ),
        corner: cornerFont(width, height, ratio, margin, slot === "end"),
    };
}

function badgeMargin(width: number, height: number) {
    return Math.max(8, Math.min(width, height) * 0.02);
}

/**
 * Place the badges. Both use the same mode and font size so they look alike:
 * corners (digital top-left, alarm top-right) on square-ish windows, otherwise
 * the strips beside (landscape) or above/below (portrait) the face.
 */
function placeBadges(
    width: number,
    height: number,
    ratios: Partial<Record<Slot, Ratio>>,
): Partial<Record<Slot, Placement>> {
    const slots = (Object.keys(ratios) as Slot[]).filter((s) => ratios[s]);
    if (slots.length === 0) return {};

    const fits = slots.map((slot) =>
        fitBadge(width, height, ratios[slot]!, slot),
    );
    const stripFont = Math.min(...fits.map((f) => f.strip));
    const cornerFontSize = Math.min(...fits.map((f) => f.corner));
    const useCorners = cornerFontSize > stripFont * CORNER_ADVANTAGE;
    const font = useCorners ? cornerFontSize : stripFont * STRIP_SCALE;

    const face = Math.min(width, height);
    const margin = badgeMargin(width, height);
    const landscape = width >= height;
    const strip = (Math.max(width, height) - face) / 2;

    const result: Partial<Record<Slot, Placement>> = {};
    for (const slot of slots) {
        const ratio = ratios[slot]!;
        const w = ratio.w * font;
        const h = ratio.h * font;
        let left: number;
        let top: number;
        if (useCorners) {
            left = slot === "end" ? width - margin - w : margin;
            top = margin;
        } else if (landscape) {
            left = slot === "start" ? (strip - w) / 2 : width - (strip + w) / 2;
            top = (height - h) / 2;
        } else {
            left = (width - w) / 2;
            top = slot === "start" ? (strip - h) / 2 : height - (strip + h) / 2;
        }
        result[slot] = { fontSize: font, left, top };
    }
    return result;
}

const SLOTS: Slot[] = ["start", "end"];

/**
 * Full screen clock: the face is always as large as possible and the badges
 * use whatever space is left, either beside the face or in the corners.
 */
export function ClockStage({
    currentTime,
    children,
}: BadgeProps & { children: ComponentChildren }) {
    const stage = useRef<HTMLDivElement>(null);
    const start = useRef<HTMLDivElement>(null);
    const end = useRef<HTMLDivElement>(null);
    const [placements, setPlacements] = useState<
        Partial<Record<Slot, Placement>>
    >({});

    useLayoutEffect(() => {
        const slotRefs = { start, end };

        const update = () => {
            const stageEl = stage.current;
            if (!stageEl) return;

            const ratios: Partial<Record<Slot, Ratio>> = {};
            for (const slot of SLOTS) {
                const badge = slotRefs[slot].current
                    ?.firstElementChild as HTMLElement | null;
                if (!badge) continue;
                const font = parseFloat(getComputedStyle(badge).fontSize);
                if (!font) continue;
                ratios[slot] = {
                    w: badge.offsetWidth / font,
                    h: badge.offsetHeight / font,
                };
            }

            const next = placeBadges(
                stageEl.clientWidth,
                stageEl.clientHeight,
                ratios,
            );
            setPlacements((prev) => (samePlacements(prev, next) ? prev : next));
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(stage.current!);
        observer.observe(start.current!);
        observer.observe(end.current!);
        return () => observer.disconnect();
    }, []);

    const slotStyle = (slot: Slot) => {
        const p = placements[slot];
        return {
            left: `${p?.left ?? 0}px`,
            top: `${p?.top ?? 0}px`,
            fontSize: `${p?.fontSize ?? 40}px`,
            visibility: p ? "visible" : "hidden",
        };
    };

    return (
        <div ref={stage} class="clock-stage">
            <div class="clock-face">{children}</div>
            <div
                ref={start}
                class="clock-badge-slot"
                data-slot="start"
                style={slotStyle("start")}
            >
                <DigitalClockBadge currentTime={currentTime} />
            </div>
            <div
                ref={end}
                class="clock-badge-slot"
                data-slot="end"
                style={slotStyle("end")}
            >
                <AlarmBadge currentTime={currentTime} />
            </div>
        </div>
    );
}

function samePlacements(
    a: Partial<Record<Slot, Placement>>,
    b: Partial<Record<Slot, Placement>>,
) {
    return SLOTS.every((slot) => {
        const x = a[slot];
        const y = b[slot];
        if (!x || !y) return x === y;
        return (
            Math.abs(x.fontSize - y.fontSize) < 0.5 &&
            Math.abs(x.left - y.left) < 0.5 &&
            Math.abs(x.top - y.top) < 0.5
        );
    });
}
