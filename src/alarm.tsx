import { signal, computed, effect } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

// Local storage key
const ALARM_STORAGE_KEY = "kello-alarm-settings";

// Default alarm settings (hours now 0-11)
const DEFAULT_SETTINGS = { enabled: false, hours: 7, minutes: 0 };

// Load saved alarm settings from localStorage
function loadAlarmSettings(): {
    enabled: boolean;
    hours: number;
    minutes: number;
} {
    const saved = localStorage.getItem(ALARM_STORAGE_KEY);
    if (!saved) {
        return DEFAULT_SETTINGS;
    }
    // Parsing external data requires error handling
    try {
        const result = JSON.parse(saved) as Record<string, unknown> | null;
        if (!result || typeof result !== "object") {
            return DEFAULT_SETTINGS;
        }
        const hours = typeof result.hours === "number" ? result.hours % 12 : 7;
        return {
            enabled:
                typeof result.enabled === "boolean" ? result.enabled : false,
            hours: hours,
            minutes: typeof result.minutes === "number" ? result.minutes : 0,
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

// Initialize signals with saved values
const savedSettings = loadAlarmSettings();

// Alarm state (hours stored as 0-11)
export const alarmEnabled = signal(savedSettings.enabled);
export const alarmHours = signal(savedSettings.hours);
export const alarmMinutes = signal(savedSettings.minutes);
export const alarmTriggered = signal(false);

// Save alarm settings to localStorage whenever they change
effect(() => {
    const settings = {
        enabled: alarmEnabled.value,
        hours: alarmHours.value,
        minutes: alarmMinutes.value,
    };
    localStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(settings));
});

// Audio context for alarm sound
let audioContext: AudioContext | null = null;
let oscillatorNode: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

// Computed signal for formatted alarm time (shows 12-hour format)
export const alarmTimeFormatted = computed(() => {
    const h = alarmHours.value.toString().padStart(2, "0");
    const m = alarmMinutes.value.toString().padStart(2, "0");
    return `${h}:${m}`;
});

// Check if current time matches alarm time (triggers on both AM and PM)
export function checkAlarm(currentTime: Date): boolean {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();

    // Convert current 24-hour time to 12-hour format for comparison
    const hours12 = hours % 12;

    console.log("checkAlarm called:", {
        enabled: alarmEnabled.value,
        triggered: alarmTriggered.value,
        currentTime: `${hours}:${minutes}`,
        alarmTime: `${alarmHours.value}:${alarmMinutes.value}`,
        hours12,
    });

    if (!alarmEnabled.value || alarmTriggered.value) {
        return false;
    }

    // Match on 12-hour basis (triggers at both AM and PM)
    return hours12 === alarmHours.value && minutes === alarmMinutes.value;
}

// Play a pleasant alarm sound
export function playAlarmSound() {
    if (audioContext) return; // Already playing

    audioContext = new AudioContext();
    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    gainNode.gain.setValueAtTime(1, audioContext.currentTime);

    // Create a pleasant chime-like sound
    const playChime = (startTime: number, frequency: number) => {
        const osc = audioContext!.createOscillator();
        const oscGain = audioContext!.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, startTime);

        oscGain.gain.setValueAtTime(0, startTime);
        oscGain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);

        osc.connect(oscGain);
        oscGain.connect(gainNode!);

        osc.start(startTime);
        osc.stop(startTime + 0.8);
    };

    // Play a repeating chime pattern
    const playPattern = () => {
        if (!audioContext) return;

        const now = audioContext.currentTime;
        // Pleasant chord: C5, E5, G5
        playChime(now, 523.25); // C5
        playChime(now + 0.15, 659.25); // E5
        playChime(now + 0.3, 783.99); // G5
        playChime(now + 0.6, 1046.5); // C6

        // Repeat after 1.5 seconds
        setTimeout(() => {
            if (alarmTriggered.value && audioContext) {
                playPattern();
            }
        }, 1500);
    };

    playPattern();
}

// Stop the alarm sound
export function stopAlarmSound() {
    if (oscillatorNode) {
        oscillatorNode.stop();
        oscillatorNode.disconnect();
        oscillatorNode = null;
    }
    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}

// Trigger the alarm
export function triggerAlarm() {
    alarmTriggered.value = true;
    playAlarmSound();
}

// Dismiss the alarm
export function dismissAlarm() {
    alarmTriggered.value = false;
    stopAlarmSound();
}

// Reset alarm for next day (call when minute changes away from alarm time)
export function resetAlarmTrigger() {
    if (alarmTriggered.value) return; // Don't reset if still triggered
    // This allows the alarm to trigger again the next day
}

// Update alarm hours with wrapping (0-11)
export function setAlarmHours(hours: number) {
    alarmHours.value = ((hours % 12) + 12) % 12;
}

// Update alarm minutes with wrapping
export function setAlarmMinutes(minutes: number) {
    alarmMinutes.value = ((minutes % 60) + 60) % 60;
}

// Toggle alarm enabled state
export function toggleAlarm() {
    alarmEnabled.value = !alarmEnabled.value;
    if (!alarmEnabled.value) {
        dismissAlarm();
    }
}

// Flashing state for alarm
export const flashState = signal(false);

// Hook to manage flash effect
export function useAlarmFlash() {
    useEffect(() => {
        if (!alarmTriggered.value) {
            flashState.value = false;
            return;
        }

        const flashInterval = setInterval(() => {
            flashState.value = !flashState.value;
        }, 500);

        return () => clearInterval(flashInterval);
    }, [alarmTriggered.value]);
}

export function AlarmToggle() {
    return (
        <button
            onClick={toggleAlarm}
            class={`w-full px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                alarmEnabled.value
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            title={alarmEnabled.value ? "Alarm is set" : "Alarm is off"}
        >
            {alarmEnabled.value ? "⏰ Alarm On" : "🔕 Alarm Off"}
        </button>
    );
}

export function AlarmTimeInput() {
    const handleHoursChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const value = parseInt(target.value, 10);
        if (!isNaN(value)) {
            setAlarmHours(value);
        }
    };

    const handleMinutesChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const value = parseInt(target.value, 10);
        if (!isNaN(value)) {
            setAlarmMinutes(value);
        }
    };

    return (
        <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600">Alarm:</label>
            <input
                type="number"
                min="0"
                max="11"
                value={alarmHours.value}
                onInput={handleHoursChange}
                class="w-14 px-2 py-1 text-center border border-gray-300 rounded text-sm bg-white text-gray-900"
            />
            <span class="text-gray-600">:</span>
            <input
                type="number"
                min="0"
                max="59"
                value={alarmMinutes.value}
                onInput={handleMinutesChange}
                class="w-14 px-2 py-1 text-center border border-gray-300 rounded text-sm bg-white text-gray-900"
            />
        </div>
    );
}

// Computed signal for alarm hand angle (12-hour display)
export const alarmHandAngle = computed(() => {
    const hours = alarmHours.value;
    const minutes = alarmMinutes.value;
    return ((hours + minutes / 60) / 12) * 360;
});

// Hook to provide alarm hand drag functionality
export function useAlarmHandDrag(svgRef: { current: SVGSVGElement | null }) {
    const isDragging = useRef(false);

    const getAngleFromEvent = (
        clientX: number,
        clientY: number,
    ): number | null => {
        const svg = svgRef.current;
        if (!svg) return null;

        const rect = svg.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = clientX - centerX;
        const dy = clientY - centerY;

        // Calculate angle in degrees (0 = top, clockwise)
        let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
        if (angle < 0) angle += 360;

        return angle;
    };

    const updateAlarmFromAngle = (angle: number) => {
        // Convert angle to hours (0-12) and minutes
        const totalHours = (angle / 360) * 12;
        const hours = Math.floor(totalHours);
        const minutes = Math.round((totalHours - hours) * 60);

        alarmHours.value = hours % 12;
        alarmMinutes.value = minutes % 60;
    };

    const handleStart = (clientX: number, clientY: number) => {
        isDragging.current = true;
        const angle = getAngleFromEvent(clientX, clientY);
        if (angle !== null) {
            updateAlarmFromAngle(angle);
        }
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (!isDragging.current) return;
        const angle = getAngleFromEvent(clientX, clientY);
        if (angle !== null) {
            updateAlarmFromAngle(angle);
        }
    };

    const handleEnd = () => {
        isDragging.current = false;
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            handleMove(e.clientX, e.clientY);
        };

        const handleMouseUp = () => {
            handleEnd();
        };

        const handleTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            if (touch) {
                handleMove(touch.clientX, touch.clientY);
            }
        };

        const handleTouchEnd = () => {
            handleEnd();
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("touchmove", handleTouchMove);
        document.addEventListener("touchend", handleTouchEnd);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleTouchEnd);
        };
    }, []);

    return { handleStart };
}

interface AlarmHandProps {
    svgRef: { current: SVGSVGElement | null };
}

export function AlarmHand({ svgRef }: AlarmHandProps) {
    const { handleStart } = useAlarmHandDrag(svgRef);

    const onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        handleStart(e.clientX, e.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
            handleStart(touch.clientX, touch.clientY);
        }
    };

    return (
        <g
            style={{ cursor: "pointer" }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
        >
            <line
                x1="50"
                y1="50"
                x2="50"
                y2="35"
                stroke="#f97316"
                stroke-width="1"
                stroke-linecap="round"
                transform={`rotate(${alarmHandAngle.value} 50 50)`}
            />
        </g>
    );
}

export function AlarmOverlay() {
    useAlarmFlash();

    if (!alarmTriggered.value) {
        return null;
    }

    return (
        <div
            class={`fixed inset-0 flex items-center justify-center z-50 transition-colors ${
                flashState.value ? "bg-yellow-400" : "bg-orange-500"
            }`}
            onClick={dismissAlarm}
        >
            <div class="text-center">
                <div class="text-8xl mb-8">⏰</div>
                <div class="text-4xl font-bold text-white mb-4">WAKE UP!</div>
                <div class="text-2xl text-white mb-8">
                    {alarmHours.value.toString().padStart(2, "0")}:
                    {alarmMinutes.value.toString().padStart(2, "0")}
                </div>
                <button
                    onClick={dismissAlarm}
                    class="px-8 py-4 bg-white text-orange-500 font-bold text-xl rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                >
                    Dismiss
                </button>
            </div>
        </div>
    );
}
