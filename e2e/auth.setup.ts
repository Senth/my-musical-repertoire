import { test as setup } from "@playwright/test";
import { AUTH_STATE } from "@/playwright.config";
import { signIn } from "./support/app";

/**
 * Signs in once and saves the session for every other project.
 *
 * Firebase keeps its session in IndexedDB, which `storageState` ignored until
 * Playwright 1.51 — `indexedDB: true` is what makes this a real shortcut
 * rather than a file that lands the suite back on `/login`.
 */
setup("authenticate", async ({ page, context }) => {
	await signIn(page);
	await context.storageState({ path: AUTH_STATE, indexedDB: true });
});
