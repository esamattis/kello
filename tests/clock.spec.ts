import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

function fontSize(locator: Locator) {
    return locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}

async function boxes(page: Page) {
    const get = async (locator: Locator) => {
        const box = await locator.boundingBox();
        if (!box) throw new Error("element not visible");
        return box;
    };
    return {
        face: await get(page.locator(".clock-face")),
        digital: await get(page.getByTestId("digital-clock")),
        alarm: await get(page.getByTestId("alarm-badge")),
    };
}

const alarmOn = { alarmEnabled: "true" };

test("digital clock shows hours and minutes with small seconds", async ({
    app,
    page,
}) => {
    await app.open();
    const digital = page.getByTestId("digital-clock");
    await expect(digital).toHaveText("10:0000");
    await expect(digital.locator(".clock-badge-small")).toHaveText("00");

    await app.tick(2000);
    await expect(digital.locator(".clock-badge-small")).toHaveText("02");

    const [big, small] = await Promise.all([
        fontSize(digital.locator(".clock-badge-time > span").first()),
        fontSize(digital.locator(".clock-badge-small")),
    ]);
    expect(small).toBeLessThan(big / 2);
});

test("analog clock face renders all dial numbers", async ({ app, page }) => {
    await app.open();
    const svg = page.locator("svg").first();
    for (const n of ["12", "3", "6", "9", "15", "24", "45"]) {
        await expect(svg.getByText(n, { exact: true }).first()).toBeAttached();
    }
});

test("alarm hand is only shown when the alarm is enabled", async ({ app }) => {
    await app.open();
    await expect(app.alarmHand).toHaveCount(0);

    await app.alarmSwitch.click();
    await expect(app.alarmHand).toHaveCount(1);
});

test("alarm hand points at the alarm time", async ({ app }) => {
    // 03:00 -> quarter turn
    await app.open({
        alarmEnabled: "true",
        alarmHours: "3",
        alarmMinutes: "0",
    });
    await expect(app.alarmHand).toHaveAttribute(
        "transform",
        "rotate(90 50 50)",
    );
});

test("clicking or dragging the clock face does not change the alarm", async ({
    app,
    page,
}) => {
    await app.open({ alarmEnabled: "true" });
    const box = await app.clockFace.boundingBox();
    if (!box) throw new Error("clock face not visible");

    // Press near "3 o'clock" and drag towards "6 o'clock"
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.9);
    await page.mouse.up();

    expect(await app.alarmPicker.text()).toBe("08:30");
});

test("bell badge shows alarm time and countdown when enabled", async ({
    app,
    page,
}) => {
    await app.open();
    const badge = page.getByTestId("alarm-badge");
    await expect(badge).toHaveCount(0);

    await app.open({
        alarmEnabled: "true",
        alarmHours: "10",
        alarmMinutes: "15",
    });
    await expect(badge.getByLabel("Hälytysaika")).toHaveText("10:15");
    await expect(badge.getByLabel("Aikaa herätykseen")).toHaveText("0:15:00");
});

test.describe("badge layout", () => {
    test("landscape: digital clock left, alarm right of the face", async ({
        app,
        page,
    }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await app.open(alarmOn);
        const { face, digital, alarm } = await boxes(page);
        expect(digital.x + digital.width).toBeLessThanOrEqual(face.x);
        expect(alarm.x).toBeGreaterThanOrEqual(face.x + face.width);
    });

    test("portrait: digital clock above, alarm below the face", async ({
        app,
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await app.open(alarmOn);
        const { face, digital, alarm } = await boxes(page);
        expect(digital.y + digital.height).toBeLessThanOrEqual(face.y);
        expect(alarm.y).toBeGreaterThanOrEqual(face.y + face.height);
    });

    for (const [width, height] of [
        [800, 800],
        [1000, 800],
        [800, 950],
    ] as const) {
        test(`square-ish ${width}x${height}: badges go to the top corners`, async ({
            app,
            page,
        }) => {
            await page.setViewportSize({ width, height });
            await app.open(alarmOn);
            const { digital, alarm } = await boxes(page);
            const margin = 24;
            expect(digital.x).toBeLessThan(margin);
            expect(digital.y).toBeLessThan(margin);
            expect(width - (alarm.x + alarm.width)).toBeLessThan(margin);
            expect(alarm.y).toBeLessThan(margin);
        });
    }

    test("badges grow with the available space", async ({ app, page }) => {
        await page.setViewportSize({ width: 844, height: 390 });
        await app.open(alarmOn);
        const small = (await boxes(page)).digital.height;

        await page.setViewportSize({ width: 1920, height: 1080 });
        await app.tick(100);
        const large = (await boxes(page)).digital.height;
        expect(large).toBeGreaterThan(small * 1.5);
    });

    test("both badges use the same font size", async ({ app, page }) => {
        for (const [width, height] of [
            [390, 844],
            [1280, 720],
            [1000, 800],
        ] as const) {
            await page.setViewportSize({ width, height });
            await app.open(alarmOn);
            const sizes = await page
                .locator(".clock-badge-slot")
                .evaluateAll((els) => els.map((el) => el.style.fontSize));
            expect(sizes[0]).toBe(sizes[1]);
        }
    });

    for (const [width, height] of [
        [320, 568],
        [568, 320],
        [390, 844],
        [844, 390],
        [800, 800],
        [1000, 800],
        [800, 950],
        [1024, 1366],
        [1440, 900],
        [1920, 1080],
        [3840, 1600],
    ] as const) {
        test(`face is maximized and badges fit at ${width}x${height}`, async ({
            app,
            page,
        }) => {
            await page.setViewportSize({ width, height });
            await app.open(alarmOn);
            const all = await boxes(page);
            const { face } = all;

            // Face always fills the short side of the screen
            expect(face.width).toBeCloseTo(Math.min(width, height), 0);

            for (const box of Object.values(all)) {
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.y).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
                expect(box.y + box.height).toBeLessThanOrEqual(height + 0.5);
            }

            // Badges never cover the round face: check every badge corner
            const cx = face.x + face.width / 2;
            const cy = face.y + face.height / 2;
            const radius = face.width * 0.49;
            for (const badge of [all.digital, all.alarm]) {
                const px = Math.min(
                    Math.max(cx, badge.x),
                    badge.x + badge.width,
                );
                const py = Math.min(
                    Math.max(cy, badge.y),
                    badge.y + badge.height,
                );
                expect(Math.hypot(px - cx, py - cy)).toBeGreaterThanOrEqual(
                    radius,
                );
            }
        });
    }
});
