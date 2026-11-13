import { test, expect } from "./fixtures";

test("alarm is off by default with the default time", async ({ app }) => {
    await app.open();
    await expect(app.alarmSwitch).toHaveAttribute("aria-checked", "false");
    await expect(app.alarmStatus).toHaveText("Pois päältä");
    expect(await app.alarmPicker.text()).toBe("08:30");
});

test("master switch toggles the alarm and persists in the URL", async ({
    app,
}) => {
    await app.open();
    await app.alarmSwitch.click();
    await expect(app.alarmSwitch).toHaveAttribute("aria-checked", "true");
    // 10:00 -> next 08:30 occurrence is 20:30 (12-hour alarm)
    await expect(app.alarmStatus).toHaveText("Soi 10 h 30 min päästä");
    expect((await app.urlParams()).get("alarmEnabled")).toBe("true");

    await app.alarmSwitch.click();
    await expect(app.alarmSwitch).toHaveAttribute("aria-checked", "false");
    await expect(app.alarmStatus).toHaveText("Pois päältä");
    expect((await app.urlParams()).has("alarmEnabled")).toBe(false);
});

test("picking a time enables the alarm", async ({ app }) => {
    await app.open();
    await app.alarmPicker.pick(9, 45);

    expect(await app.alarmPicker.text()).toBe("09:45");
    await expect(app.alarmSwitch).toHaveAttribute("aria-checked", "true");
    // 10:00 -> next 9:45 on the dial is 21:45
    await expect(app.alarmStatus).toHaveText("Soi 11 h 45 min päästä");

    const params = await app.urlParams();
    expect(params.get("alarmHours")).toBe("9");
    expect(params.get("alarmMinutes")).toBe("45");
});

test("picker is a 12-hour dial without AM/PM", async ({ app }) => {
    await app.open();
    const hourOptions = await app.alarmPicker.hours
        .locator("option")
        .allTextContents();
    expect(hourOptions).toEqual([
        "12",
        "01",
        "02",
        "03",
        "04",
        "05",
        "06",
        "07",
        "08",
        "09",
        "10",
        "11",
    ]);
    const minuteOptions = await app.alarmPicker.minutes
        .locator("option")
        .allTextContents();
    expect(minuteOptions).toEqual([
        "00",
        "05",
        "10",
        "15",
        "20",
        "25",
        "30",
        "35",
        "40",
        "45",
        "50",
        "55",
    ]);
    await expect(app.alarmPicker.group).not.toContainText(/AM|PM|ap|ip/);

    await app.alarmPicker.pick(12, 15);
    expect(await app.alarmPicker.text()).toBe("12:15");
    expect((await app.urlParams()).get("alarmHours")).toBe("0");
});

test("old 24-hour URL values are shown on the 12-hour dial", async ({
    app,
}) => {
    await app.open({
        alarmEnabled: "true",
        alarmHours: "20",
        alarmMinutes: "5",
    });
    expect(await app.alarmPicker.text()).toBe("08:05");
    await expect(app.alarmStatus).toHaveText("Soi 10 h 5 min päästä");
});

test("alarm settings are restored from the URL", async ({ app }) => {
    await app.open({
        alarmEnabled: "true",
        alarmHours: "11",
        alarmMinutes: "5",
    });
    await expect(app.alarmSwitch).toHaveAttribute("aria-checked", "true");
    expect(await app.alarmPicker.text()).toBe("11:05");
    await expect(app.alarmStatus).toHaveText("Soi 1 h 5 min päästä");
});

test("countdown shows under-a-minute text", async ({ app }) => {
    await app.open({
        alarmEnabled: "true",
        alarmHours: "10",
        alarmMinutes: "1",
    });
    await app.tick(30_000);
    await expect(app.alarmStatus).toHaveText("Soi alle minuutin päästä");
});

test.describe("quick shortcuts", () => {
    test("there is a button for every 5 minutes from 5 to 60", async ({
        app,
    }) => {
        await app.open();
        for (let m = 5; m <= 60; m += 5) {
            await expect(app.quickButton(m)).toBeVisible();
        }
        await expect(app.quickButton(65)).toHaveCount(0);
    });

    for (const [minutes, expected, status] of [
        [5, "10:05", "Soi 5 min päästä"],
        [30, "10:30", "Soi 30 min päästä"],
        [60, "11:00", "Soi 1 h 0 min päästä"],
    ] as const) {
        test(`+${minutes} sets alarm to ${expected} and enables it`, async ({
            app,
        }) => {
            await app.open();
            await app.quickButton(minutes).click();
            expect(await app.alarmPicker.text()).toBe(expected);
            await expect(app.alarmSwitch).toHaveAttribute(
                "aria-checked",
                "true",
            );
            await expect(app.alarmStatus).toHaveText(status);
        });
    }

    test("rounds to the nearest minute", async ({ app }) => {
        await app.open({}, new Date("2026-11-13T10:00:40Z"));
        await app.quickButton(10).click();
        expect(await app.alarmPicker.text()).toBe("10:11");
    });

    test("an off-grid minute is added to the 5 min picker", async ({ app }) => {
        await app.open({}, new Date("2026-11-13T10:03:00Z"));
        await app.quickButton(5).click();
        expect(await app.alarmPicker.text()).toBe("10:08");
        const options = await app.alarmPicker.minutes
            .locator("option")
            .allTextContents();
        expect(options).toContain("08");
        expect(options).toHaveLength(13);

        // Picking a grid value drops the extra option again
        await app.alarmPicker.minutes.selectOption("15");
        await expect(app.alarmPicker.minutes.locator("option")).toHaveCount(12);
    });

    test("wraps past midnight", async ({ app }) => {
        await app.open({}, new Date("2026-11-13T23:50:00Z"));
        await app.quickButton(20).click();
        expect(await app.alarmPicker.text()).toBe("12:10");
        await expect(app.alarmStatus).toHaveText("Soi 20 min päästä");
    });
});

test.describe("ringing", () => {
    test("alarm rings at the set time and click dismisses it", async ({
        app,
        page,
    }) => {
        await app.open(
            { alarmEnabled: "true", alarmHours: "10", alarmMinutes: "1" },
            new Date("2026-11-13T10:00:58Z"),
        );
        await expect(app.body).not.toHaveClass(/alarm-flash-background/);

        await app.tick(3000);
        await expect(app.body).toHaveClass(/alarm-flash-background/);

        await page.mouse.click(5, 300);
        await expect(app.body).not.toHaveClass(/alarm-flash-background/);
        await expect(app.alarmSwitch).toHaveAttribute("aria-checked", "false");
    });

    test("alarm also rings 12 hours later (AM/PM)", async ({ app }) => {
        await app.open(
            { alarmEnabled: "true", alarmHours: "22", alarmMinutes: "1" },
            new Date("2026-11-13T10:00:58Z"),
        );
        await app.tick(3000);
        await expect(app.body).toHaveClass(/alarm-flash-background/);
    });

    test("alarm does not ring when disabled", async ({ app }) => {
        await app.open(
            { alarmHours: "10", alarmMinutes: "1" },
            new Date("2026-11-13T10:00:58Z"),
        );
        await app.tick(3000);
        await expect(app.body).not.toHaveClass(/alarm-flash-background/);
    });

    test("test button rings and dismissing keeps the alarm on", async ({
        app,
        page,
    }) => {
        await app.open({ alarmEnabled: "true" });
        await page.getByRole("button", { name: "Testaa hälytysääni" }).click();
        await expect(app.body).toHaveClass(/alarm-flash-background/);

        await page.mouse.click(5, 300);
        await expect(app.body).not.toHaveClass(/alarm-flash-background/);
        await expect(app.alarmSwitch).toHaveAttribute("aria-checked", "true");
    });
});
