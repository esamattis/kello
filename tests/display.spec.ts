import { test, expect } from "./fixtures";

test.describe("dark mode", () => {
    test("toggles theme and persists it", async ({ app, page }) => {
        await app.open();
        expect(await app.theme()).toBe("light");
        await expect(app.darkModeStatus).toHaveText("Pois päältä");

        await app.darkModeSwitch.click();
        expect(await app.theme()).toBe("dark");
        await expect(app.darkModeSwitch).toHaveAttribute(
            "aria-checked",
            "true",
        );
        await expect(app.darkModeStatus).toHaveText("Päällä");
        expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
            "dark",
        );

        await page.reload();
        expect(await app.theme()).toBe("dark");
    });

    test("auto-off options are only shown in dark mode", async ({ app }) => {
        await app.open();
        await expect(app.autoOffSwitch).toHaveCount(0);

        await app.darkModeSwitch.click();
        await expect(app.autoOffSwitch).toBeVisible();
        await expect(app.autoOffPicker.group).toHaveCount(0);

        await app.autoOffSwitch.click();
        expect(await app.autoOffPicker.text()).toBe("07:00");
        await expect(app.darkModeStatus).toHaveText("Sammuu klo 07:00");
    });

    test("auto-off turns dark mode off at the set time", async ({
        app,
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem("theme", "dark");
        });
        await app.open({}, new Date("2026-11-13T09:59:58Z"));

        await app.autoOffSwitch.click();
        await app.autoOffPicker.pick(10, 0);
        await expect(app.darkModeStatus).toHaveText("Sammuu klo 10:00");
        expect(
            await page.evaluate(() => ({
                enabled: localStorage.getItem("darkModeAutoOffEnabled"),
                time: localStorage.getItem("darkModeAutoOffTime"),
            })),
        ).toEqual({ enabled: "true", time: "10:00" });

        expect(await app.theme()).toBe("dark");
        await app.tick(3000);
        expect(await app.theme()).toBe("light");
        await expect(app.darkModeSwitch).toHaveAttribute(
            "aria-checked",
            "false",
        );
    });

    test("auto-off only happens in the morning", async ({ app, page }) => {
        await page.addInitScript(() => {
            localStorage.setItem("theme", "dark");
            localStorage.setItem("darkModeAutoOffEnabled", "true");
            localStorage.setItem("darkModeAutoOffTime", "10:00");
        });
        await app.open({}, new Date("2026-11-13T21:59:58Z"));
        await app.tick(3000);
        expect(await app.theme()).toBe("dark");
    });
});

test("wake lock toggle keeps the screen on", async ({ app, page }) => {
    await app.open();
    const toggle = page.getByLabel("Pidä näyttö päällä");
    await expect(toggle).not.toBeChecked();

    await page.getByText("Pidä näyttö päällä").click();
    await expect(toggle).toBeChecked();

    await page.getByText("Pidä näyttö päällä").click();
    await expect(toggle).not.toBeChecked();
});

test("fullscreen toggle enters fullscreen and enables wake lock", async ({
    app,
    page,
}) => {
    await app.open();
    await page.getByRole("button", { name: "Koko näyttö" }).click();

    await expect(
        page.getByRole("button", { name: "Poistu koko näytöstä" }),
    ).toBeVisible();
    await expect(page.getByLabel("Pidä näyttö päällä")).toBeChecked();

    await page.getByRole("button", { name: "Poistu koko näytöstä" }).click();
    await expect(
        page.getByRole("button", { name: "Koko näyttö" }),
    ).toBeVisible();
});

test("ui has no emojis", async ({ app, page }) => {
    await app.open({ alarmEnabled: "true", preAlarmEnabled: "true" });
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
});

test("voice debug view lists voices", async ({ app, page }) => {
    await page.clock.install({ time: new Date("2026-11-13T10:00:00Z") });
    await page.goto("/?debug=voices");
    await expect(
        page.getByRole("heading", { name: "Äänet (1)" }),
    ).toBeVisible();
    await expect(page.getByText("fi-FI")).toBeVisible();

    await page.getByRole("button", { name: "Testaa ääntä" }).click();
    expect(await app.spoken()).toEqual(["Tämä on äänitesti"]);
});
