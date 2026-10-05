import { writeFile } from "node:fs/promises";
import { expect, test as setup } from "@playwright/test";
import { signIn } from "@/e2e/support/app";
import { AUTH_STATE } from "@/playwright.config";

/**
 * Signs in once and saves the session for every other project.
 *
 * Firebase keeps its session in IndexedDB, which `storageState` ignored until
 * Playwright 1.51 — `indexedDB: true` is what makes this a real shortcut
 * rather than a file that lands the suite back on `/login`.
 */
setup("authenticate", async ({ page, context }) => {
	await signIn(page);
	const state = await context.storageState({ indexedDB: true });
	for (const origin of state.origins) {
		origin.indexedDB = origin.indexedDB?.filter(
			(db) => db.name === "firebaseLocalStorageDb",
		);
		origin.localStorage = origin.localStorage.filter(
			(entry) => !entry.name.startsWith("firestore_"),
		);
	}
	expect(
		state.origins
			.flatMap((origin) => origin.indexedDB ?? [])
			.map((db) => db.name),
	).toEqual(["firebaseLocalStorageDb"]);
	await writeFile(AUTH_STATE, JSON.stringify(state));
});
