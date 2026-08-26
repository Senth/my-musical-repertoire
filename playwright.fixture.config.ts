import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * `yarn fixture` only. Builds `.emulator-seed/` by driving the app against an
 * empty emulator suite — see docs/OPERATIONS.md.
 *
 * A separate config rather than a project, because a project would run on
 * every `yarn e2e` and try to register the seeded account a second time.
 */
export default defineConfig({
	...base,
	testIgnore: undefined,
	testMatch: /fixture\.setup\.ts/,
	retries: 0,
	projects: [{ name: "fixture", use: { ...devices["Desktop Chrome"] } }],
});
