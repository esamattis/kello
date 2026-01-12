import { signal, computed, Signal } from "@preact/signals";
import { ToggleButton } from "./ToggleButton";
import { Tooltip } from "./Tooltip";
import { useEffect, useRef } from "preact/hooks";
import { urlSignal } from "./utils";

// Dragging state for alarm hand
export const alarmHandDragging = signal(false);

// Alarm state (hours stored as 0-11)
export const alarmEnabled = urlSignal<boolean>("alarmEnabled", false);
export const alarmHours = urlSignal<number>("alarmHours", 7);
export const alarmMinutes = urlSignal<number>("alarmMinutes", 0);
export const preAlarmEnabled = urlSignal<boolean>("preAlarmEnabled", false);
export const preAlarmInterval = urlSignal<number>("preAlarmInterval", 5);
export const alarmTriggered = signal(false);

// Export preAlarmEnabled as a type-safe function for use in components
export const togglePreAlarm = () => {
    preAlarmEnabled.value = !preAlarmEnabled.value;
};

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

function computeMinutesUntilAlarm(currentTime: Date): number {
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const alarmTotalMinutes1 = alarmHours.value * 60 + alarmMinutes.value;
    const alarmTotalMinutes2 =
        (alarmHours.value + 12) * 60 + alarmMinutes.value;

    if (currentTotalMinutes < alarmTotalMinutes1) {
        return alarmTotalMinutes1 - currentTotalMinutes;
    } else if (currentTotalMinutes < alarmTotalMinutes2) {
        return alarmTotalMinutes2 - currentTotalMinutes;
    } else {
        return 24 * 60 - currentTotalMinutes + alarmTotalMinutes1;
    }
}

// Computed signal for time until next alarm
export function computeTimeToNextAlarm(currentTime: Signal<Date>) {
    return computed(() => {
        if (!alarmEnabled.value) {
            return null;
        }

        const now = currentTime.value;
        const currentSeconds = now.getSeconds();
        const minutesUntilAlarm = computeMinutesUntilAlarm(now);
        const secondsUntilAlarm = minutesUntilAlarm * 60 - currentSeconds;

        const hours = Math.floor(secondsUntilAlarm / 3600);
        const minutes = Math.floor((secondsUntilAlarm % 3600) / 60);
        const seconds = secondsUntilAlarm % 60;

        return { hours, minutes, seconds };
    });
}

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
    audioContext.resume();
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

function playDing() {
    return new Promise<void>((resolve) => {
        const ctx = new AudioContext();
        ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        const duration = 800;
        osc.stop(ctx.currentTime + duration / 1000);

        setTimeout(() => {
            ctx.close();
            resolve();
        }, duration);
    });
}

function getFinnishVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang.startsWith("fi-")) || null;
}

function speakMessage(
    text: string,
    voice: SpeechSynthesisVoice | null,
): Promise<void> {
    return new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = voice?.lang ?? "en-US";
        if (voice) {
            utterance.voice = voice;
        }
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 0.7;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
    });
}

async function waitForVoicesLoaded(): Promise<void> {
    await new Promise<void>((resolve) => {
        const done = () => {
            clearTimeout(timeout);
            window.speechSynthesis.removeEventListener("voiceschanged", done);
            resolve();
        };

        const timeout = setTimeout(done, 1000);
        window.speechSynthesis.addEventListener("voiceschanged", done);
    });
}

export async function playPreAlarmDing(minutesRemaining: number) {
    await playDing();
    if (!("speechSynthesis" in window) || !window.speechSynthesis) {
        return;
    }

    const hours = Math.floor(minutesRemaining / 60);
    const minutes = minutesRemaining % 60;

    let finnishVoice = getFinnishVoice();

    if (!finnishVoice) {
        // getVoices() might be initially empty, wait for them to load
        await waitForVoicesLoaded();
        finnishVoice = getFinnishVoice();
    }

    if (finnishVoice) {
        let message: string;
        if (hours > 0 && minutes > 0) {
            const hourWord = hours === 1 ? "tunti" : "tuntia";
            message = `${hours} ${hourWord} ja ${minutes} minuuttia jäljellä`;
        } else if (hours > 0) {
            const hourWord = hours === 1 ? "tunti" : "tuntia";
            message = `${hours} ${hourWord} jäljellä`;
        } else {
            message = `${minutes} minuuttia jäljellä`;
        }
        await speakMessage(message, finnishVoice);
    } else {
        let message: string;
        if (hours > 0 && minutes > 0) {
            const hourWord = hours === 1 ? "hour" : "hours";
            message = `${hours} ${hourWord} and ${minutes} minutes remaining`;
        } else if (hours > 0) {
            const hourWord = hours === 1 ? "hour" : "hours";
            message = `${hours} ${hourWord} remaining`;
        } else {
            message = `${minutes} minutes remaining`;
        }
        await speakMessage(message, null);
    }
}

// Track last pre-alarm notification minute to avoid re-triggering
const lastPreAlarmMinute = signal(-1);

// Export lastPreAlarmMinute for testing
export { lastPreAlarmMinute };

export function checkPreAlarm(currentTime: Date): number | false {
    if (!preAlarmEnabled.value || !alarmEnabled.value || alarmTriggered.value) {
        return false;
    }

    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const minutesUntilAlarm = computeMinutesUntilAlarm(currentTime);

    if (
        minutesUntilAlarm > 0 &&
        minutesUntilAlarm % preAlarmInterval.value === 0
    ) {
        if (currentTotalMinutes !== lastPreAlarmMinute.value) {
            lastPreAlarmMinute.value = currentTotalMinutes;
            return minutesUntilAlarm;
        }
    }

    return false;
}

// Trigger the alarm
export function triggerAlarm() {
    alarmTriggered.value = true;
    playAlarmSound();
}

// Dismiss the alarm
export function dismissAlarm() {
    alarmTriggered.value = false;
    alarmEnabled.value = false;
    stopAlarmSound();
}

// Test the alarm for a short duration
export function testAlarm() {
    if (alarmTriggered.value) return; // Already triggered
    window.scrollTo({ top: 0, behavior: "smooth" });
    alarmTriggered.value = true;
    playAlarmSound();
}

// Test the pre-alarm notification
export function testPreAlarm() {
    const currentTime = new Date();
    const minutesUntilAlarm = computeMinutesUntilAlarm(currentTime);
    playPreAlarmDing(minutesUntilAlarm);
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

export function AlarmToggle() {
    return (
        <ToggleButton
            checked={alarmEnabled.value}
            checkbox
            onChange={toggleAlarm}
            checkedClass="bg-orange-500 text-white hover:bg-orange-600"
        >
            ⏰ Hälytys
        </ToggleButton>
    );
}

export function AlarmTestButton() {
    return (
        <button
            type="button"
            onClick={testAlarm}
            class="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
        >
            🔔 Testaa hälytys
        </button>
    );
}

interface AlarmTimeInputProps {
    currentTime: Signal<Date>;
}

export function AlarmTimeInput({ currentTime }: AlarmTimeInputProps) {
    const timeToNextAlarm = computeTimeToNextAlarm(currentTime);

    const handleTimeChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const parts = target.value.split(":");
        const hours = Number(parts[0]);
        const minutes = Number(parts[1]);
        if (!isNaN(hours) && !isNaN(minutes)) {
            setAlarmHours(hours);
            setAlarmMinutes(minutes);
        }
    };

    const handleIntervalChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const value = Number(target.value);
        if (!isNaN(value) && value >= 1) {
            preAlarmInterval.value = value;
        }
    };

    const timeValue =
        `${String(alarmHours.value).padStart(2, "0")}:` +
        `${String(alarmMinutes.value).padStart(2, "0")}`;

    if (!alarmEnabled.value) {
        return null;
    }

    return (
        <div class="w-full px-4 py-4 rounded-full text-sm font-medium bg-gray-200 text-gray-700 flex items-center justify-center">
            <div class="w-44 flex flex-col gap-1">
                <div class="flex items-center gap-2">
                    <label class="text-gray-600">Herätys:</label>
                    <div class="relative">
                        <input
                            type="time"
                            value={timeValue}
                            onInput={handleTimeChange}
                            class="w-28 pl-2 pr-7 py-1 border border-gray-300 rounded text-sm bg-white text-gray-900"
                        />
                    </div>
                </div>
                <div class="text-[10px] text-gray-500 italic">
                    Voit sää&shy;tää he&shy;rä&shy;tys&shy;tä myös
                    ve&shy;tä&shy;mäl&shy;lä vii&shy;sa&shy;ria
                </div>
                {timeToNextAlarm.value && (
                    <div class="text-xs text-gray-500">
                        {timeToNextAlarm.value.hours}h{" "}
                        {timeToNextAlarm.value.minutes}min{" "}
                        {timeToNextAlarm.value.seconds}s päästä
                    </div>
                )}
                <div class="flex mt-5 items-center gap-2">
                    <input
                        type="checkbox"
                        id="pre-alarm"
                        checked={preAlarmEnabled.value}
                        onChange={togglePreAlarm}
                        class="w-4 h-4"
                    />
                    <label
                        for="pre-alarm"
                        class="text-xs text-gray-600 cursor-pointer"
                    >
                        Väliaikaviestit
                    </label>
                    {preAlarmEnabled.value && (
                        <Tooltip
                            content="Testaa väliaikaviesti"
                            position="right"
                        >
                            <button
                                type="button"
                                onClick={testPreAlarm}
                                class="px-2 py-1 text-xs bg-gray-300 hover:bg-gray-400 text-gray-700 rounded transition-colors"
                            >
                                🔊
                            </button>
                        </Tooltip>
                    )}
                </div>
                {preAlarmEnabled.value && (
                    <div class="flex items-center gap-2">
                        <select
                            value={preAlarmInterval.value}
                            onInput={handleIntervalChange}
                            class="w-20 pl-2 pr-6 py-1 border border-gray-300 rounded text-xs bg-white text-gray-900"
                        >
                            {Array.from({ length: 60 }, (_, i) => i + 1).map(
                                (value) => (
                                    <option value={value}>{value}</option>
                                ),
                            )}
                        </select>
                        <label class="text-xs text-gray-600">min välein</label>
                    </div>
                )}
            </div>
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
        alarmHandDragging.value = true;
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
        alarmHandDragging.value = false;
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
                y2={alarmHandDragging.value ? "15" : "35"}
                stroke="#f97316"
                stroke-width={alarmHandDragging.value ? "2" : "1"}
                stroke-linecap="round"
                transform={`rotate(${alarmHandAngle.value} 50 50)`}
            />
        </g>
    );
}

export function AlarmFlashBackground() {
    useEffect(() => {
        if (!alarmTriggered.value) return;

        const handleDismiss = () => {
            dismissAlarm();
        };

        document.addEventListener("click", handleDismiss);
        document.addEventListener("touchstart", handleDismiss);

        return () => {
            document.removeEventListener("click", handleDismiss);
            document.removeEventListener("touchstart", handleDismiss);
        };
    }, [alarmTriggered.value]);

    if (!alarmTriggered.value) {
        return null;
    }

    return <div class="fixed inset-0 -z-10 alarm-flash-background" />;
}
