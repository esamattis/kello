import { test, expect } from "./fixtures";

test("pre-alarm options are hidden until enabled", async ({ app, page }) => {
    await app.open();
    const intervals = page.getByRole("radiogroup", {
        name: "Väliaikaviestien väli",
    });
    await expect(intervals).toHaveCount(0);

    await app.preAlarmSwitch.click();
    await expect(app.preAlarmSwitch).toHaveAttribute("aria-checked", "true");
    await expect(intervals).toBeVisible();
    expect((await app.urlParams()).get("preAlarmEnabled")).toBe("true");
});

test("interval can be selected and persists in the URL", async ({
    app,
    page,
}) => {
    await app.open({ preAlarmEnabled: "true" });
    const five = page.getByRole("radio", { name: "5 min", exact: true });
    const fifteen = page.getByRole("radio", { name: "15 min" });
    await expect(five).toHaveAttribute("aria-checked", "true");

    await fifteen.click();
    await expect(fifteen).toHaveAttribute("aria-checked", "true");
    await expect(five).toHaveAttribute("aria-checked", "false");
    expect((await app.urlParams()).get("preAlarmInterval")).toBe("15");
});

test("example button speaks the remaining time with the selected voice", async ({
    app,
    page,
}) => {
    // 632 minutes left is not on the 5 min interval, so only the example speaks
    await app.open({
        preAlarmEnabled: "true",
        alarmEnabled: "true",
        alarmMinutes: "32",
    });
    const example = page.getByRole("button", { name: /Kuuntele esimerkki/ });
    await expect(example).toContainText("Satu");

    await example.click();
    await app.tick(1000);
    expect(await app.spoken()).toEqual(["10 tuntia ja 32 minuuttia jäljellä"]);
});

test("announces remaining time on each interval", async ({ app }) => {
    await app.open(
        {
            alarmEnabled: "true",
            preAlarmEnabled: "true",
            preAlarmInterval: "5",
            alarmHours: "10",
            alarmMinutes: "30",
        },
        new Date("2026-11-13T10:19:58Z"),
    );
    // 10:20 -> 10 minutes left
    await app.tick(3000);
    expect(await app.spoken()).toEqual(["10 minuuttia jäljellä"]);

    // 10:21 is not on the interval
    await app.tick(60_000);
    expect(await app.spoken()).toHaveLength(1);

    // 10:25 -> 5 minutes left
    await app.tick(4 * 60_000);
    expect(await app.spoken()).toEqual([
        "10 minuuttia jäljellä",
        "5 minuuttia jäljellä",
    ]);
});

test("does not announce when the alarm is off", async ({ app }) => {
    await app.open(
        {
            preAlarmEnabled: "true",
            alarmHours: "10",
            alarmMinutes: "30",
        },
        new Date("2026-11-13T10:19:58Z"),
    );
    await app.tick(3000);
    expect(await app.spoken()).toEqual([]);
});
