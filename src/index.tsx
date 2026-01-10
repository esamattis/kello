import { render } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { signal, Signal, computed } from "@preact/signals";
import "./style.css";
import { ToggleButton } from "./ToggleButton";
import {
    checkAlarm,
    triggerAlarm,
    AlarmToggle,
    AlarmTimeInput,
    AlarmOverlay,
    AlarmHand,
    alarmEnabled,
    alarmHandDragging,
    useAlarmHandDrag,
    computeTimeToNextAlarm,
    alarmTimeFormatted,
} from "./alarm";
import { Tooltip } from "./Tooltip";

// Wake Lock state
const wakeLockEnabled = signal(false);
const wakeLockSupported = signal("wakeLock" in navigator);
let wakeLockSentinel: WakeLockSentinel | null = null;

// Fullscreen state
const fullscreenEnabled = signal(false);
const fullscreenSupported = signal(
    document.fullscreenEnabled ||
        // @ts-ignore - webkit prefixed
        document.webkitFullscreenEnabled ||
        false,
);

async function requestWakeLock() {
    if (!wakeLockSupported.value) {
        alert("Wake Lock API ei ole tuettu tässä selaimessa.");
        return;
    }

    try {
        wakeLockSentinel = await navigator.wakeLock.request("screen");
    } catch (err) {
        console.error("Wake Lock -pyyntö epäonnistui:", err);
        alert("Wake Lock -pyyntö epäonnistui.");
        return;
    }

    wakeLockEnabled.value = true;

    wakeLockSentinel.addEventListener("release", () => {
        wakeLockEnabled.value = false;
    });
}

async function releaseWakeLock() {
    if (wakeLockSentinel) {
        await wakeLockSentinel.release();
        wakeLockSentinel = null;
        wakeLockEnabled.value = false;
    }
}

async function toggleWakeLock() {
    if (wakeLockEnabled.value) {
        await releaseWakeLock();
    } else {
        await requestWakeLock();
    }
}

async function toggleFullscreen() {
    if (!fullscreenSupported.value) return;

    if (fullscreenEnabled.value) {
        if (document.exitFullscreen) {
            await document.exitFullscreen();
        }
    } else {
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
            // Scroll to top after entering fullscreen
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }
}

// Signal to store the current time
const currentTime = signal(new Date());

// Track last checked minute to avoid re-triggering
const lastCheckedMinute = signal(-1);

// Computed signals for clock hands angles
const secondsAngle = computed(() => {
    const seconds = currentTime.value.getSeconds();
    return (seconds / 60) * 360;
});

const minutesAngle = computed(() => {
    const minutes = currentTime.value.getMinutes();
    return (minutes / 60) * 360;
});

const hoursAngle = computed(() => {
    const hours = currentTime.value.getHours() % 12;
    const minutes = currentTime.value.getMinutes();
    return ((hours + minutes / 60) / 12) * 360;
});

function AnalogClock() {
    const svgRef = useRef<SVGSVGElement>(null);
    const { handleStart } = useAlarmHandDrag(svgRef);

    const onClockFaceClick = (e: MouseEvent) => {
        if (!alarmEnabled.value) return;
        e.preventDefault();
        handleStart(e.clientX, e.clientY);
    };

    const onClockFaceTouchStart = (e: TouchEvent) => {
        if (!alarmEnabled.value) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
            handleStart(touch.clientX, touch.clientY);
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            currentTime.value = new Date();

            // Check alarm once per minute
            const currentMinute =
                currentTime.value.getHours() * 60 +
                currentTime.value.getMinutes();
            if (currentMinute !== lastCheckedMinute.value) {
                lastCheckedMinute.value = currentMinute;

                if (checkAlarm(currentTime.value)) {
                    triggerAlarm();
                }
            }
        }, 50);

        return () => clearInterval(interval);
    }, []);

    // Generate hour markers
    const hourMarkers = [];
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * 360;
        hourMarkers.push(
            <line
                key={`hour-${i}`}
                x1="50"
                y1="8"
                x2="50"
                y2="12"
                stroke="#333333"
                stroke-width="2"
                stroke-linecap="round"
                transform={`rotate(${angle} 50 50)`}
            />,
        );
    }

    // Generate minute markers
    const minuteMarkers = [];
    for (let i = 0; i < 60; i++) {
        if (i % 5 !== 0) {
            const angle = (i / 60) * 360;
            minuteMarkers.push(
                <line
                    key={`minute-${i}`}
                    x1="50"
                    y1="9"
                    x2="50"
                    y2="11"
                    stroke="#666666"
                    stroke-width="0.5"
                    stroke-linecap="round"
                    transform={`rotate(${angle} 50 50)`}
                />,
            );
        }
    }

    // Generate hour numbers
    const hourNumbers = [];
    for (let i = 1; i <= 12; i++) {
        const angle = ((i / 12) * 360 - 90) * (Math.PI / 180);
        const radius = 32;
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        hourNumbers.push(
            <text
                key={`number-${i}`}
                x={x}
                y={y}
                text-anchor="middle"
                dominant-baseline="central"
                font-size="8"
                font-family="Arial, sans-serif"
                font-weight="bold"
                fill="#333333"
            >
                {i}
            </text>,
        );
    }

    // Generate 24-hour numbers (smaller, below the regular numbers)
    const hour24Numbers = [];
    for (let i = 1; i <= 12; i++) {
        const angle = ((i / 12) * 360 - 90) * (Math.PI / 180);
        const radius = 25; // Closer to center than the 12-hour numbers
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        const hour24 = i + 12; // 13-24
        hour24Numbers.push(
            <text
                key={`number-24-${i}`}
                x={x}
                y={y}
                text-anchor="middle"
                dominant-baseline="central"
                font-size="4"
                font-family="Arial, sans-serif"
                fill="#888888"
            >
                {hour24}
            </text>,
        );
    }

    // Generate minute numbers (5, 10, 15, etc.) close to the border
    const minuteNumbers = [];
    for (let i = 1; i <= 12; i++) {
        const minute = i * 5;
        const angle = ((i / 12) * 360 - 90) * (Math.PI / 180);
        const radius = 45; // Just outside the tick markers
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        minuteNumbers.push(
            <text
                key={`minute-number-${minute}`}
                x={x}
                y={y}
                text-anchor="middle"
                dominant-baseline="central"
                font-size="2.5"
                font-family="Arial, sans-serif"
                // fill="#e53e3e" // red
                fill="#888888"
            >
                {minute}
            </text>,
        );
    }

    return (
        <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            style={{
                width: "100%",
                height: "100%",
                maxWidth: "100vmin",
                maxHeight: "100vmin",
                display: "block",
                userSelect: "none",
            }}
        >
            {/* Clock face */}
            <circle
                cx="50"
                cy="50"
                r="48"
                fill="#ffffff"
                stroke="#333333"
                stroke-width="2"
                style={{
                    cursor: alarmEnabled.value ? "pointer" : "default",
                }}
                onMouseDown={onClockFaceClick}
                onTouchStart={onClockFaceTouchStart}
            />

            {/* Hour markers */}
            {hourMarkers}

            {/* Minute markers */}
            {minuteMarkers}

            {/* Hour numbers */}
            {hourNumbers}

            {/* 24-hour numbers */}
            {hour24Numbers}

            {/* Minute numbers (5, 10, 15, etc.) */}
            {minuteNumbers}

            {/* Hour hand */}
            <line
                x1="50"
                y1="50"
                x2="50"
                y2="28"
                stroke="#222222"
                stroke-width="3"
                stroke-linecap="round"
                transform={`rotate(${hoursAngle.value} 50 50)`}
            />

            {/* Minute hand */}
            <line
                x1="50"
                y1="50"
                x2="50"
                y2="18"
                stroke="#444444"
                stroke-width="2"
                stroke-linecap="round"
                transform={`rotate(${minutesAngle.value} 50 50)`}
            />

            {/* Second hand */}
            <line
                x1="50"
                y1="55"
                x2="50"
                y2="14"
                stroke="#e53e3e"
                stroke-width="1"
                stroke-linecap="round"
                transform={`rotate(${secondsAngle.value} 50 50)`}
            />

            {/* Alarm hand (only shown when alarm is enabled) - rendered last to be on top */}
            {alarmEnabled.value && <AlarmHand svgRef={svgRef} />}

            {/* Center dot */}
            <circle cx="50" cy="50" r="2.5" fill="#222222" />
            <circle cx="50" cy="50" r="1" fill="#e53e3e" />
        </svg>
    );
}

function DigitalClock() {
    const timeString = computed(() => {
        const hours = currentTime.value.getHours().toString().padStart(2, "0");
        const minutes = currentTime.value
            .getMinutes()
            .toString()
            .padStart(2, "0");
        const seconds = currentTime.value
            .getSeconds()
            .toString()
            .padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    });

    return (
        <div
            class="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded-lg font-mono text-lg font-bold shadow-lg"
            style={{ zIndex: 1000 }}
        >
            {timeString.value}
        </div>
    );
}

function AlarmBellIcon() {
    if (!alarmEnabled.value) {
        return null;
    }

    const timeToAlarm = computeTimeToNextAlarm(currentTime);
    const countdown = timeToAlarm.value;

    return (
        <div
            class="absolute top-4 right-4 bg-orange-500 bg-opacity-90 p-2 rounded-lg shadow-lg flex flex-col items-center gap-1"
            style={{
                zIndex: 1000,
                transform: alarmHandDragging.value ? "scale(2)" : "scale(1)",
                transformOrigin: "top right",
                transition: "transform 0.2s ease-out",
            }}
            title="Alarm is active"
        >
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
                    stroke="white"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
                <path
                    d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
                    stroke="white"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
            <Tooltip content="Herätysaika" position="left">
                <div class="text-white font-mono text-xs font-bold">
                    {alarmTimeFormatted.value}
                </div>
            </Tooltip>

            {countdown && (
                <Tooltip content="Aika seuraavaan herätykseen" position="left">
                    <div class="text-white font-mono text-[10px] font-bold opacity-80">
                        {countdown.hours.toString().padStart(2, "0")}:
                        {countdown.minutes.toString().padStart(2, "0")}
                    </div>
                </Tooltip>
            )}
        </div>
    );
}

function WakeLockToggle() {
    // Re-acquire wake lock when page becomes visible again
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (
                document.visibilityState === "visible" &&
                wakeLockEnabled.value &&
                !wakeLockSentinel
            ) {
                await requestWakeLock();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
        };
    }, []);

    if (!wakeLockSupported.value) {
        return null;
    }

    return (
        <Tooltip
            content={
                wakeLockEnabled.value
                    ? "Napsauta salliaksesi näytön sammumisen"
                    : "Napsauta pitääksesi näytön päällä"
            }
        >
            <ToggleButton
                checked={wakeLockEnabled.value}
                checkbox
                onChange={toggleWakeLock}
                checkedClass="bg-green-500 text-white hover:bg-green-600"
            >
                🔆 Pidä näyttö päällä
            </ToggleButton>
        </Tooltip>
    );
}

function FullscreenToggle() {
    useEffect(() => {
        const handleFullscreenChange = () => {
            const wasFullscreen = fullscreenEnabled.value;
            fullscreenEnabled.value = !!document.fullscreenElement;

            // Remove focus from button when exiting fullscreen
            if (wasFullscreen && !fullscreenEnabled.value) {
                (document.activeElement as HTMLElement)?.blur?.();
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange,
            );
        };
    }, []);

    if (!fullscreenSupported.value) {
        return null;
    }

    return (
        <Tooltip
            content={
                fullscreenEnabled.value
                    ? "Poistu koko näytöstä"
                    : "Siirry koko näyttöön"
            }
        >
            <ToggleButton
                checked={fullscreenEnabled.value}
                onChange={toggleFullscreen}
                checkedChildren="⛶ Poistu koko näytöstä"
            >
                ⛶ Koko näyttö
            </ToggleButton>
        </Tooltip>
    );
}

export function App() {
    return (
        <div style={{ overflow: "hidden", width: "100%" }}>
            <DigitalClock />
            <AlarmBellIcon />
            <AlarmOverlay />
            {/* Clock container - 100dvh for mobile landscape support */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100dvh",
                    width: "100%",
                    margin: 0,
                    padding: 0,
                    backgroundColor: "#f5f5f5",
                    overflow: "hidden",
                }}
            >
                <AnalogClock />
            </div>

            {/* Controls section - appears below when scrolled */}
            <div
                style={{
                    backgroundColor: "#ffffff",
                    padding: "2rem",
                    minHeight: "30vh",
                    width: "100%",
                }}
            >
                <div class="mt-5 max-w-md mx-auto flex flex-col gap-4">
                    <FullscreenToggle />
                    <WakeLockToggle />
                    <AlarmToggle />
                    <AlarmTimeInput currentTime={currentTime} />
                </div>
                <div class="mt-8 text-center">
                    <a
                        href="https://github.com/esamattis/kello"
                        rel="noopener noreferrer"
                        class="text-gray-600 hover:text-gray-900 text-sm"
                    >
                        GitHub
                    </a>
                </div>
            </div>
        </div>
    );
}

render(<App />, document.getElementById("app")!);
