import { Signal } from "@preact/signals";
import {
    alarmEnabled,
    alarmHours,
    alarmMinutes,
    computeTimeToNextAlarm,
    preAlarmEnabled,
    preAlarmInterval,
    setAlarmHours,
    setAlarmInMinutes,
    setAlarmMinutes,
    testAlarm,
    testPreAlarm,
    toggleAlarm,
    togglePreAlarm,
    voice,
} from "./alarm";
import { AlarmClockIcon, BellIcon, VolumeIcon } from "./icons";
import { Card, CardHeader, Section, SwitchRow, TimePicker } from "./ui";

const QUICK_MINUTES = Array.from({ length: 12 }, (_, i) => (i + 1) * 5);
const PRE_ALARM_INTERVALS = [1, 5, 10, 15, 30, 60];

function formatCountdown(hours: number, minutes: number) {
    if (hours === 0 && minutes === 0) {
        return "alle minuutin päästä";
    }
    if (hours === 0) {
        return `${minutes} min päästä`;
    }
    return `${hours} h ${minutes} min päästä`;
}

interface AlarmSettingsProps {
    currentTime: Signal<Date>;
}

export function AlarmSettings({ currentTime }: AlarmSettingsProps) {
    const timeToNextAlarm = computeTimeToNextAlarm(currentTime);
    const countdown = timeToNextAlarm.value;

    const handleTimeChange = (hours: number, minutes: number) => {
        setAlarmHours(hours);
        setAlarmMinutes(minutes);
        alarmEnabled.value = true;
    };

    return (
        <Card>
            <CardHeader
                icon={<AlarmClockIcon />}
                title="Herätys"
                status={
                    alarmEnabled.value && countdown
                        ? `Soi ${formatCountdown(countdown.hours, countdown.minutes)}`
                        : "Pois päältä"
                }
                active={alarmEnabled.value}
                switchLabel="Herätys päälle"
                onToggle={toggleAlarm}
            />

            <TimePicker
                label="Herätysaika"
                hours={alarmHours.value}
                minutes={alarmMinutes.value}
                onChange={handleTimeChange}
                dimmed={!alarmEnabled.value}
            />

            {/* Quick shortcuts */}
            <Section title="Herätys minuuttien päästä">
                <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {QUICK_MINUTES.map((minutes) => (
                        <button
                            key={minutes}
                            type="button"
                            onClick={() => setAlarmInMinutes(minutes)}
                            class="quick-chip rounded-lg py-2 text-sm font-medium tabular-nums transition-colors"
                        >
                            +{minutes}
                        </button>
                    ))}
                </div>
            </Section>

            {/* Pre-alarm announcements */}
            <Section title="Väliaikaviestit">
                <SwitchRow
                    text="Kerro jäljellä oleva aika ääneen"
                    checked={preAlarmEnabled.value}
                    onChange={togglePreAlarm}
                    label="Väliaikaviestit päälle"
                />
                {preAlarmEnabled.value && (
                    <>
                        <div
                            role="radiogroup"
                            aria-label="Väliaikaviestien väli"
                            class="segmented grid grid-cols-6 gap-1 rounded-lg p-1"
                        >
                            {PRE_ALARM_INTERVALS.map((interval) => {
                                const selected =
                                    preAlarmInterval.value === interval;
                                return (
                                    <button
                                        key={interval}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() =>
                                            (preAlarmInterval.value = interval)
                                        }
                                        class={`rounded-md py-1.5 text-xs font-medium tabular-nums transition-colors ${
                                            selected
                                                ? "bg-orange-500 text-white shadow"
                                                : "segmented-option"
                                        }`}
                                    >
                                        {interval} min
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={testPreAlarm}
                            class="self-start inline-flex items-center gap-1.5 text-xs themed-subtle-text underline underline-offset-2 hover:text-[var(--text-primary)]"
                        >
                            <VolumeIcon />
                            Kuuntele esimerkki
                            {voice.value ? ` (${voice.value.name})` : ""}
                        </button>
                    </>
                )}
            </Section>

            {/* Test */}
            <button
                type="button"
                onClick={testAlarm}
                class="quick-chip w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
                <BellIcon />
                Testaa hälytysääni
            </button>
        </Card>
    );
}
