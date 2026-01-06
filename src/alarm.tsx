import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";

// Alarm state
export const alarmEnabled = signal(false);
export const alarmHours = signal(7);
export const alarmMinutes = signal(0);
export const alarmTriggered = signal(false);

// Audio context for alarm sound
let audioContext: AudioContext | null = null;
let oscillatorNode: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

// Computed signal for formatted alarm time
export const alarmTimeFormatted = computed(() => {
    const h = alarmHours.value.toString().padStart(2, "0");
    const m = alarmMinutes.value.toString().padStart(2, "0");
    return `${h}:${m}`;
});

// Check if current time matches alarm time
export function checkAlarm(currentTime: Date): boolean {
    if (!alarmEnabled.value || alarmTriggered.value) {
        return false;
    }

    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();

    return hours === alarmHours.value && minutes === alarmMinutes.value;
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

// Update alarm hours with wrapping
export function setAlarmHours(hours: number) {
    alarmHours.value = ((hours % 24) + 24) % 24;
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
                max="23"
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
