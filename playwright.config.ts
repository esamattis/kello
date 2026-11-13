import { defineConfig, devices } from "@playwright/test";

const PORT = 5191;

export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    reporter: "list",
    use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${PORT}`,
        locale: "fi-FI",
        timezoneId: "UTC",
        trace: "retain-on-failure",
    },
    webServer: {
        command: `pnpm exec vite --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
    },
});
