import { render } from "preact";
import { signal, computed } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import "./style.css";
import {
    checkAlarm,
    triggerAlarm,
    AlarmToggle,
    AlarmTimeInput,
    AlarmOverlay,
    AlarmHand,
    alarmEnabled,
} from "./alarm";

// Wake Lock state
const wakeLockEnabled = signal(false);
const wakeLockSupported = signal("wakeLock" in navigator);
let wakeLockSentinel: WakeLockSentinel | null = null;

async function requestWakeLock() {
    if (!wakeLockSupported.value) return;

    wakeLockSentinel = await navigator.wakeLock.request("screen");
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

// Signal to store the current time
const currentTime = signal(new Date());

// Track last checked minute to avoid re-triggering
const lastCheckedMinute = signal(-1);

// Computed signals for clock hands angles
const secondsAngle = computed(() => {
    const seconds = currentTime.value.getSeconds();
    const milliseconds = currentTime.value.getMilliseconds();
    return ((seconds + milliseconds / 1000) / 60) * 360;
});

const minutesAngle = computed(() => {
    const minutes = currentTime.value.getMinutes();
    const seconds = currentTime.value.getSeconds();
    return ((minutes + seconds / 60) / 60) * 360;
});

const hoursAngle = computed(() => {
    const hours = currentTime.value.getHours() % 12;
    const minutes = currentTime.value.getMinutes();
    return ((hours + minutes / 60) / 12) * 360;
});

function AnalogClock() {
    const svgRef = useRef<SVGSVGElement>(null);

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

    return (
        <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            style={{
                width: "100vmin",
                height: "100vmin",
                display: "block",
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
            />

            {/* Hour markers */}
            {hourMarkers}

            {/* Minute markers */}
            {minuteMarkers}

            {/* Hour numbers */}
            {hourNumbers}

            {/* 24-hour numbers */}
            {hour24Numbers}

            {/* Alarm hand (only shown when alarm is enabled) */}
            {alarmEnabled.value && <AlarmHand svgRef={svgRef} />}

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

            {/* Center dot */}
            <circle cx="50" cy="50" r="2.5" fill="#222222" />
            <circle cx="50" cy="50" r="1" fill="#e53e3e" />
        </svg>
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
        <button
            onClick={toggleWakeLock}
            class={`w-full px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                wakeLockEnabled.value
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            title={
                wakeLockEnabled.value
                    ? "Screen will stay on"
                    : "Screen may turn off"
            }
        >
            {wakeLockEnabled.value ? "🔆 Staying Awake" : "💤 Allowing Sleep"}
        </button>
    );
}

export function App() {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "100vh",
                margin: 0,
                padding: 0,
                backgroundColor: "#f5f5f5",
            }}
        >
            <div class="fixed top-4 right-4 flex flex-col gap-2">
                <WakeLockToggle />
                <AlarmToggle />
                <AlarmTimeInput />
            </div>
            <AlarmOverlay />
            <AnalogClock />
        </div>
    );
}

render(<App />, document.getElementById("app")!);
