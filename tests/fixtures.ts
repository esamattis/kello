import { test as base, expect, type Page } from "@playwright/test";

export { expect };

declare global {
    interface Window {
        __spoken: string[];
    }
}

/**
 * Replaces browser APIs that are unavailable or non-deterministic in headless
 * Chromium: speech synthesis (records spoken text) and the Wake Lock API.
 */
async function installStubs(page: Page) {
    await page.addInitScript(() => {
        window.__spoken = [];

        const voice = {
            name: "Satu",
            lang: "fi-FI",
            default: true,
            localService: true,
            voiceURI: "Satu",
        };

        class FakeUtterance {
            text: string;
            voice: unknown = null;
            lang = "";
            rate = 1;
            pitch = 1;
            volume = 1;
            onend: (() => void) | null = null;
            onerror: (() => void) | null = null;
            constructor(text: string) {
                this.text = text;
            }
        }

        Object.defineProperty(window, "SpeechSynthesisUtterance", {
            value: FakeUtterance,
            configurable: true,
        });

        Object.defineProperty(window, "speechSynthesis", {
            configurable: true,
            value: {
                getVoices: () => [voice],
                speak(utterance: FakeUtterance) {
                    window.__spoken.push(utterance.text);
                    setTimeout(() => utterance.onend?.(), 0);
                },
                cancel() {},
                addEventListener() {},
                removeEventListener() {},
            },
        });

        Object.defineProperty(navigator, "wakeLock", {
            configurable: true,
            value: {
                async request() {
                    const sentinel = new EventTarget() as EventTarget & {
                        release: () => Promise<void>;
                    };
                    sentinel.release = async () => {
                        sentinel.dispatchEvent(new Event("release"));
                    };
                    return sentinel;
                },
            },
        });
    });
}

/** Fixed "now" used by tests unless they install their own clock time. */
export const NOW = new Date("2026-11-13T10:00:00Z");

export const test = base.extend<{ app: App }>({
    app: async ({ page }, use) => {
        await installStubs(page);
        await use(new App(page));
    },
});

export class App {
    constructor(readonly page: Page) {}

    /** Open the app with a fake clock frozen at `time`. */
    async open(params: Record<string, string> = {}, time: Date = NOW) {
        await this.page.clock.install({ time });
        const query = new URLSearchParams(params).toString();
        await this.page.goto(query ? `/?${query}` : "/");
        await this.tick(100);
    }

    /** Advance the fake clock. */
    async tick(ms: number) {
        await this.page.clock.runFor(ms);
    }

    get alarmSwitch() {
        return this.page.getByRole("switch", { name: "Herätys päälle" });
    }

    get preAlarmSwitch() {
        return this.page.getByRole("switch", {
            name: "Väliaikaviestit päälle",
        });
    }

    get alarmPicker() {
        return new TimePicker(this.page, "Herätysaika");
    }

    /** Settings card identified by its heading. */
    card(title: string) {
        return this.page
            .locator(".settings-card")
            .filter({ has: this.page.getByRole("heading", { name: title }) });
    }

    get alarmStatus() {
        return this.card("Herätys").getByText(/^(Soi .*|Pois päältä)$/);
    }

    get darkModeSwitch() {
        return this.page.getByRole("switch", { name: "Tumma tila päälle" });
    }

    get darkModeStatus() {
        return this.card("Tumma tila").getByText(
            /^(Päällä|Pois päältä|Sammuu klo .*)$/,
        );
    }

    get autoOffSwitch() {
        return this.page.getByRole("switch", {
            name: "Automaattinen sammutus päälle",
        });
    }

    get autoOffPicker() {
        return new TimePicker(this.page, "Sammutusaika");
    }

    get alarmHand() {
        return this.page.locator('svg line[stroke="#f97316"]');
    }

    get clockFace() {
        return this.page.locator("svg circle[r='48']");
    }

    quickButton(minutes: number) {
        return this.page.getByRole("button", {
            name: `+${minutes}`,
            exact: true,
        });
    }

    /** URL search params after urlSignal's debounced write has flushed. */
    async urlParams() {
        await this.tick(200);
        return new URL(this.page.url()).searchParams;
    }

    get body() {
        return this.page.locator("body");
    }

    async spoken() {
        return this.page.evaluate(() => window.__spoken);
    }

    async theme() {
        return this.page.evaluate(() => document.documentElement.dataset.theme);
    }
}

/** The 12-hour hour/minute select picker. */
export class TimePicker {
    constructor(
        readonly page: Page,
        readonly label: string,
    ) {}

    get group() {
        return this.page.getByRole("group", { name: this.label });
    }

    get hours() {
        return this.page.getByLabel(`${this.label}, tunnit`);
    }

    get minutes() {
        return this.page.getByLabel(`${this.label}, minuutit`);
    }

    /** Displayed time, e.g. "08:30" or "12:10". */
    async text() {
        const read = (select: ReturnType<TimePicker["hours"]["first"]>) =>
            select.evaluate(
                (el: HTMLSelectElement) =>
                    el.options[el.selectedIndex]?.textContent ?? "",
            );
        return `${await read(this.hours)}:${await read(this.minutes)}`;
    }

    /** Pick a time; hours are 1-12 as shown on the dial. */
    async pick(hours: number, minutes: number) {
        await this.hours.selectOption(String(hours % 12));
        await this.minutes.selectOption(String(minutes));
    }
}
