import { signal, computed, Signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { urlSignal } from "./utils";
import { formatDialTime } from "./ui";

// Alarm state. The clock is a 12-hour clock: hours are stored as 0-11 and the
// alarm rings at both AM and PM.
export const alarmEnabled = urlSignal<boolean>("alarmEnabled", false);
export const alarmHours = urlSignal<number>("alarmHours", 8);
export const alarmMinutes = urlSignal<number>("alarmMinutes", 30);
export const preAlarmEnabled = urlSignal<boolean>("preAlarmEnabled", false);
export const preAlarmInterval = urlSignal<number>("preAlarmInterval", 5);
export const alarmTriggered = signal(false);
// True while a test alarm is ringing so dismissing it keeps the real alarm on
let alarmIsTest = false;
export const voice = signal<SpeechSynthesisVoice | null>(null);

// Export preAlarmEnabled as a type-safe function for use in components
export const togglePreAlarm = () => {
    preAlarmEnabled.value = !preAlarmEnabled.value;
};

// Audio context for alarm sound
let audioContext: AudioContext | null = null;
let oscillatorNode: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

// Computed signal for formatted alarm time
export const alarmTimeFormatted = computed(() => {
    return formatDialTime(alarmHours.value, alarmMinutes.value);
});

function computeMinutesUntilAlarm(currentTime: Date): number {
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const alarmHours12 = alarmHours.value % 12;
    const alarmTotalMinutes1 = alarmHours12 * 60 + alarmMinutes.value;
    const alarmTotalMinutes2 = (alarmHours12 + 12) * 60 + alarmMinutes.value;

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
    return hours12 === alarmHours.value % 12 && minutes === alarmMinutes.value;
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

function setVoice() {
    const voices = window.speechSynthesis.getVoices();

    console.log(`Found ${voices.length} speech synthesis voices:`, voices);

    const fiVoices = voices.filter(
        (v) => v.lang.startsWith("fi-") || v.lang.startsWith("fi_"),
    );

    const enVoices = voices.filter(
        (v) => v.lang.startsWith("en-") || v.lang.startsWith("en_"),
    );

    voice.value =
        fiVoices.find((v) => v.name.toLowerCase().includes("satu")) ||
        fiVoices[0] ||
        enVoices[0] ||
        voice.value;

    console.log("Selected voice:", voice.value);
}

setVoice();

window.speechSynthesis.removeEventListener("voiceschanged", () => {
    setVoice();
});

window.addEventListener("load", () => {
    setVoice();
});

function speakMessage(text: string): Promise<void> {
    return new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        console.log("usinng voice", voice.value);
        utterance.voice = voice.value;
        utterance.lang = voice.value?.lang || "en-US";
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 0.7;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
    });
}

export async function playPreAlarmDing(minutesRemaining: number) {
    await playDing();
    if (!("speechSynthesis" in window) || !window.speechSynthesis) {
        return;
    }

    const hours = Math.floor(minutesRemaining / 60);
    const minutes = minutesRemaining % 60;

    if (voice.value?.lang.startsWith("fi")) {
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
        await speakMessage(message);
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
        await speakMessage(message);
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
    if (!alarmIsTest) {
        alarmEnabled.value = false;
    }
    alarmIsTest = false;
    stopAlarmSound();
}

// Test the alarm for a short duration
export function testAlarm() {
    if (alarmTriggered.value) return; // Already triggered
    window.scrollTo({ top: 0, behavior: "smooth" });
    alarmIsTest = true;
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

// Set the alarm to ring the given number of minutes from now
export function setAlarmInMinutes(minutesFromNow: number) {
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
    // Round to the nearest minute since the alarm triggers on minute changes
    if (target.getSeconds() >= 30) {
        target.setMinutes(target.getMinutes() + 1);
    }
    setAlarmHours(target.getHours());
    setAlarmMinutes(target.getMinutes());
    alarmEnabled.value = true;
}

// Toggle alarm enabled state
export function toggleAlarm() {
    alarmEnabled.value = !alarmEnabled.value;
    if (!alarmEnabled.value) {
        dismissAlarm();
    }
}

// Computed signal for alarm hand angle (12-hour display)
export const alarmHandAngle = computed(() => {
    const hours = alarmHours.value;
    const minutes = alarmMinutes.value;
    return ((hours + minutes / 60) / 12) * 360;
});

export function AlarmHand() {
    return (
        <line
            x1="50"
            y1="50"
            x2="50"
            y2="35"
            stroke="#f97316"
            stroke-width="1"
            stroke-linecap="round"
            transform={`rotate(${alarmHandAngle.value} 50 50)`}
            style={{ pointerEvents: "none" }}
        />
    );
}

export function AlarmFlashBackground() {
    useEffect(() => {
        if (!alarmTriggered.value) {
            document.body.classList.remove("alarm-flash-background");
            return;
        }

        document.body.classList.add("alarm-flash-background");

        const handleDismiss = () => {
            dismissAlarm();
        };

        document.addEventListener("click", handleDismiss);
        document.addEventListener("touchstart", handleDismiss);

        return () => {
            document.body.classList.remove("alarm-flash-background");
            document.removeEventListener("click", handleDismiss);
            document.removeEventListener("touchstart", handleDismiss);
        };
    }, [alarmTriggered.value]);

    return null;
}
