import { basename } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * The e2e stack runs against the Firebase emulator suite, never the dev
 * project — see `scripts/dev-stack.sh` and docs/OPERATIONS.md. Its web server
 * is per-checkout, mirroring the 8053/8054 rule for the servers started by
 * hand, so a run here never steals the one you are using.
 */
const webPort =
	basename(process.cwd()) === "my-musical-repertoire" ? 8055 : 8056;

export const AUTH_STATE = ".tmp/e2e/auth.json";

/**
 * `overview-suggestions.spec.ts` mutates practice-today state and creates
 * pieces it never deletes — running it against `SEED_USER` would leave the
 * shared fixture account dirty and behaving differently on a second run
 * without a re-seed in between. Its own throwaway account, registered fresh
 * every run by `overview-suggestions.setup.ts`, means the spec depends on
 * nothing about the fixture's state and leaves it untouched either way.
 */
export const OVERVIEW_AUTH_STATE = ".tmp/e2e/overview-suggestions-auth.json";

export default defineConfig({
	testDir: "./e2e",
	// The fixture builder is not part of a run — it has its own config.
	testIgnore: /fixture\.setup\.ts/,
	outputDir: ".tmp/e2e/results",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// A transient network blip in the dev server should cost a rerun, not a
	// red gate. A real failure fails twice.
	retries: 1,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI
		? [["list"], ["html", { outputFolder: ".tmp/e2e/report", open: "never" }]]
		: [["list"]],
	use: {
		baseURL: `http://localhost:${webPort}`,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{ name: "setup", testMatch: /auth\.setup\.ts/ },
		{ name: "overview-setup", testMatch: /overview-suggestions\.setup\.ts/ },

		// A claim that does not depend on width is measured once. Running every
		// spec on both viewports doubles the suite for identical results, which
		// is the single biggest waste available here.
		{
			name: "phone",
			dependencies: ["setup"],
			testIgnore: [
				/\.desktop\.spec\.ts/,
				/\.setup\.ts/,
				/overview-suggestions\.spec\.ts/,
			],
			use: {
				...devices["Pixel 7"],
				storageState: AUTH_STATE,
			},
		},
		{
			name: "desktop",
			dependencies: ["setup"],
			testMatch: [/\.desktop\.spec\.ts/, /craft\.spec\.ts/],
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1280, height: 900 },
				storageState: AUTH_STATE,
			},
		},
		// Its own project on its own throwaway account — see `OVERVIEW_AUTH_STATE`.
		{
			name: "overview-suggestions",
			dependencies: ["overview-setup"],
			testMatch: /overview-suggestions\.spec\.ts/,
			// No retry. These tests run serially and each one leaves the account
			// changed for the next, so a second attempt starts from the state the
			// first attempt already mutated — it cannot reproduce its own
			// precondition, and a green retry there would mean nothing.
			retries: 0,
			use: {
				...devices["Pixel 7"],
				storageState: OVERVIEW_AUTH_STATE,
			},
		},
	],
});
