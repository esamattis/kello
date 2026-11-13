import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { signal, Signal, computed } from "@preact/signals";
import "./style.css";
import { ToggleButton } from "./ToggleButton";
import {
    checkAlarm,
    triggerAlarm,
    AlarmFlashBackground,
    AlarmHand,
    alarmEnabled,
    alarmTriggered,
    checkPreAlarm,
    playPreAlarmDing,
} from "./alarm";
import { AlarmSettings } from "./AlarmSettings";
import { ClockStage } from "./ClockBadges";
import { MaximizeIcon, MinimizeIcon, MoonIcon, SunIcon } from "./icons";
import { Tooltip } from "./Tooltip";
import {
    Card,
    CardHeader,
    formatDialTime,
    formatTime,
    Section,
    SwitchRow,
    TimePicker,
} from "./ui";

// Wake Lock state
const wakeLockEnabled = signal(false);
const wakeLockSupported = signal("wakeLock" in navigator);
let wakeLockSentinel: WakeLockSentinel | null = null;

const storedTheme = window.localStorage.getItem("theme");
const storedDarkModeAutoOffEnabled = window.localStorage.getItem(
    "darkModeAutoOffEnabled",
);
const storedDarkModeAutoOffTime = window.localStorage.getItem(
    "darkModeAutoOffTime",
);
const darkModeEnabled = signal(
    storedTheme !== null ? storedTheme === "dark" : false,
);
const darkModeAutoOffEnabled = signal(storedDarkModeAutoOffEnabled === "true");
const darkModeAutoOffTime = signal(
    storedDarkModeAutoOffTime && /^\d{2}:\d{2}$/.test(storedDarkModeAutoOffTime)
        ? storedDarkModeAutoOffTime
        : "07:00",
);

function applyTheme(isDark: boolean) {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

function persistDarkModePreference() {
    window.localStorage.setItem(
        "theme",
        darkModeEnabled.value ? "dark" : "light",
    );
}

function persistDarkModeAutoOff() {
    window.localStorage.setItem(
        "darkModeAutoOffEnabled",
        darkModeAutoOffEnabled.value ? "true" : "false",
    );
    window.localStorage.setItem(
        "darkModeAutoOffTime",
        darkModeAutoOffTime.value,
    );
}

function setDarkModeEnabled(isDark: boolean) {
    darkModeEnabled.value = isDark;
    applyTheme(isDark);
    persistDarkModePreference();
}

function toggleDarkMode() {
    setDarkModeEnabled(!darkModeEnabled.value);
}

function toggleDarkModeAutoOff() {
    darkModeAutoOffEnabled.value = !darkModeAutoOffEnabled.value;
    persistDarkModeAutoOff();
}

function shouldDisableDarkMode(currentTime: Date) {
    if (!darkModeEnabled.value || !darkModeAutoOffEnabled.value) {
        return false;
    }

    const parts = darkModeAutoOffTime.value.split(":");
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    // The picker is a 12-hour dial and auto-off happens in the morning (AM)
    return (
        !isNaN(hours) &&
        !isNaN(minutes) &&
        currentTime.getHours() === hours % 12 &&
        currentTime.getMinutes() === minutes
    );
}

applyTheme(darkModeEnabled.value);

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

// Signals for tick animation
const secondTick = signal(false);
const minuteTick = signal(false);
const lastSecond = signal(-1);
const lastMinute = signal(-1);

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
    useEffect(() => {
        const interval = setInterval(() => {
            currentTime.value = new Date();

            // Trigger second tick animation
            const currentSecond = currentTime.value.getSeconds();
            if (currentSecond !== lastSecond.value) {
                lastSecond.value = currentSecond;
                secondTick.value = true;
                setTimeout(() => {
                    secondTick.value = false;
                }, 150);
            }

            // Trigger minute tick animation
            const currentMin = currentTime.value.getMinutes();
            if (currentMin !== lastMinute.value) {
                lastMinute.value = currentMin;
                minuteTick.value = true;
                setTimeout(() => {
                    minuteTick.value = false;
                }, 150);
            }

            // Check alarm once per minute
            const currentMinute =
                currentTime.value.getHours() * 60 +
                currentTime.value.getMinutes();
            if (currentMinute !== lastCheckedMinute.value) {
                lastCheckedMinute.value = currentMinute;

                if (shouldDisableDarkMode(currentTime.value)) {
                    setDarkModeEnabled(false);
                }

                if (checkAlarm(currentTime.value)) {
                    triggerAlarm();
                }

                // Check pre-alarm notifications
                const minutesRemaining = checkPreAlarm(currentTime.value);
                if (minutesRemaining) {
                    playPreAlarmDing(minutesRemaining);
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
                stroke="var(--clock-hour-marker)"
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
                    stroke="var(--clock-minute-marker)"
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
                fill="var(--clock-hour-number)"
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
                fill="var(--clock-hour24-number)"
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
                fill="var(--clock-minute-number)"
            >
                {minute}
            </text>,
        );
    }

    return (
        <svg
            viewBox="0 0 100 100"
            style={{
                width: "100%",
                height: "100%",
                display: "block",
                userSelect: "none",
            }}
        >
            {/* Clock face */}
            <circle
                cx="50"
                cy="50"
                r="48"
                fill="var(--clock-face)"
                stroke="var(--clock-ring)"
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

            {/* Minute numbers (5, 10, 15, etc.) */}
            {minuteNumbers}

            {/* Hour hand */}
            <line
                x1="50"
                y1="50"
                x2="50"
                y2="28"
                stroke="var(--clock-hour-hand)"
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
                stroke="var(--clock-minute-hand)"
                stroke-width="2"
                stroke-linecap="round"
                class={minuteTick.value ? "hand-tick" : ""}
                style={{
                    "--rotation": `${minutesAngle.value}deg`,
                    transform: `rotate(${minutesAngle.value}deg)`,
                    transformOrigin: "50px 50px",
                }}
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
                class={secondTick.value ? "hand-tick" : ""}
                style={{
                    "--rotation": `${secondsAngle.value}deg`,
                    transform: `rotate(${secondsAngle.value}deg)`,
                    transformOrigin: "50px 50px",
                }}
            />

            {/* Alarm hand (only shown when alarm is enabled) - rendered last to be on top */}
            {alarmEnabled.value && <AlarmHand />}

            {/* Center dot */}
            <circle cx="50" cy="50" r="2.5" fill="var(--clock-center)" />
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
                <SunIcon class="mr-1.5" />
                Pidä näyttö päällä
            </ToggleButton>
        </Tooltip>
    );
}

function FullscreenToggle() {
    useEffect(() => {
        const handleFullscreenChange = () => {
            const wasFullscreen = fullscreenEnabled.value;
            fullscreenEnabled.value = !!document.fullscreenElement;

            // Activate wake lock automatically when entering fullscreen
            if (!wasFullscreen && fullscreenEnabled.value) {
                if (wakeLockSupported.value && !wakeLockEnabled.value) {
                    requestWakeLock();
                }
            }

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
                checkedChildren={
                    <>
                        <MinimizeIcon class="mr-1.5" />
                        Poistu koko näytöstä
                    </>
                }
            >
                <MaximizeIcon class="mr-1.5" />
                Koko näyttö
            </ToggleButton>
        </Tooltip>
    );
}

function DarkModeSettings() {
    const [autoOffHours, autoOffMinutes] = darkModeAutoOffTime.value
        .split(":")
        .map(Number);

    const handleAutoOffTimeChange = (hours: number, minutes: number) => {
        darkModeAutoOffTime.value = formatTime(hours, minutes);
        persistDarkModeAutoOff();
    };

    let status = "Pois päältä";
    if (darkModeEnabled.value) {
        status = darkModeAutoOffEnabled.value
            ? `Sammuu klo ${formatDialTime(autoOffHours ?? 7, autoOffMinutes ?? 0)}`
            : "Päällä";
    }

    return (
        <Card>
            <CardHeader
                icon={<MoonIcon />}
                title="Tumma tila"
                status={status}
                active={darkModeEnabled.value}
                switchLabel="Tumma tila päälle"
                onToggle={toggleDarkMode}
            />

            {darkModeEnabled.value && (
                <Section title="Automaattinen sammutus">
                    <SwitchRow
                        text="Vaihda vaaleaan tilaan aamulla"
                        checked={darkModeAutoOffEnabled.value}
                        onChange={toggleDarkModeAutoOff}
                        label="Automaattinen sammutus päälle"
                    />
                    {darkModeAutoOffEnabled.value && (
                        <TimePicker
                            label="Sammutusaika"
                            hours={autoOffHours ?? 7}
                            minutes={autoOffMinutes ?? 0}
                            onChange={handleAutoOffTimeChange}
                        />
                    )}
                </Section>
            )}
        </Card>
    );
}

function VoiceDebug() {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    const refreshVoices = () => {
        const newVoices = window.speechSynthesis.getVoices();
        setVoices(newVoices);
        setRefreshKey((prev) => prev + 1);
    };

    const testVoice = (voice: SpeechSynthesisVoice) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("Tämä on äänitesti");
        utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
    };

    useEffect(() => {
        refreshVoices();

        const handleVoicesChanged = () => {
            alert("Voices changed event detected");
            refreshVoices();
        };

        window.speechSynthesis.addEventListener(
            "voiceschanged",
            handleVoicesChanged,
        );

        return () => {
            window.speechSynthesis.removeEventListener(
                "voiceschanged",
                handleVoicesChanged,
            );
        };
    }, []);

    return (
        <div class="min-h-screen bg-white p-4 text-gray-900">
            <div class="max-w-4xl mx-auto">
                <div class="flex justify-between items-center mb-6">
                    <h1 class="text-2xl font-bold text-gray-900">
                        Äänet ({voices.length})
                    </h1>
                    <button
                        onClick={refreshVoices}
                        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Päivitä äänet
                    </button>
                    <button
                        onClick={() => (document.location.href = "/")}
                        class="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-300"
                    >
                        Takaisin
                    </button>
                </div>
                <div class="space-y-3">
                    {[...voices]
                        .sort((a, b) => {
                            const langCompare = a.lang.localeCompare(b.lang);
                            if (langCompare !== 0) return langCompare;
                            return a.name.localeCompare(b.name);
                        })
                        .map((voice, index) => (
                            <div
                                key={`${voice.name}-${index}-${refreshKey}`}
                                class="border border-gray-300 p-4 rounded-lg bg-white"
                            >
                                <div class="font-semibold text-lg mb-2 text-gray-900">
                                    {voice.name}
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                                    <div>
                                        <span class="font-medium text-gray-900">
                                            Kieli:
                                        </span>{" "}
                                        {voice.lang}
                                    </div>
                                    <div>
                                        <span class="font-medium text-gray-900">
                                            Oletus:
                                        </span>{" "}
                                        {voice.default ? "Kyllä" : "Ei"}
                                    </div>
                                    <div>
                                        <span class="font-medium text-gray-900">
                                            Paikallinen:
                                        </span>{" "}
                                        {voice.localService ? "Kyllä" : "Ei"}
                                    </div>
                                    <div>
                                        <span class="font-medium text-gray-900">
                                            URI:
                                        </span>{" "}
                                        {voice.voiceURI || "Ei saatavilla"}
                                    </div>
                                </div>
                                <button
                                    onClick={() => testVoice(voice)}
                                    class="mt-3 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                                >
                                    Testaa ääntä
                                </button>
                            </div>
                        ))}
                    {voices.length === 0 && (
                        <div class="text-gray-500 text-center py-8">
                            Ei ääniä saatavilla
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function App() {
    return (
        <div
            style={{
                overflow: "hidden",
                width: "100%",
                backgroundColor: alarmTriggered.value
                    ? "transparent"
                    : "var(--app-bg)",
                color: "var(--text-primary)",
            }}
        >
            <AlarmFlashBackground />
            <ClockStage currentTime={currentTime}>
                <AnalogClock />
            </ClockStage>

            {/* Controls section - appears below when scrolled */}
            <div
                style={{
                    backgroundColor: "var(--panel-bg)",
                    color: "var(--text-primary)",
                    padding: "2rem",
                    minHeight: "30vh",
                    width: "100%",
                }}
            >
                <div class="mt-5 max-w-md mx-auto flex flex-col gap-3">
                    <FullscreenToggle />
                    <WakeLockToggle />
                    <AlarmSettings currentTime={currentTime} />
                    <DarkModeSettings />
                </div>
                <footer class="footer-links mt-8 pt-6 text-center flex flex-col items-center gap-3 max-w-md mx-auto">
                    <a
                        href="https://github.com/esamattis/kello"
                        rel="noopener noreferrer"
                        class="footer-link text-sm"
                    >
                        GitHub
                    </a>
                    <a href="?debug=voices" class="footer-link text-sm">
                        Debug-näkymä
                    </a>
                </footer>
            </div>
        </div>
    );
}

window.addEventListener("load", () => {
    // https://stackoverflow.com/q/22812303/153718
    window.speechSynthesis.getVoices();
    const params = new URLSearchParams(window.location.search);
    const showVoiceDebug = params.get("debug") === "voices";
    if (showVoiceDebug) {
        render(<VoiceDebug />, document.getElementById("app")!);
    } else {
        render(<App />, document.getElementById("app")!);
    }
});
