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
	const origins = state.origins.map((origin) => {
		const databases: unknown[] =
			"indexedDB" in origin && Array.isArray(origin.indexedDB)
				? origin.indexedDB
				: [];
		return {
			...origin,
			indexedDB: databases.filter(
				(db) =>
					typeof db === "object" &&
					db !== null &&
					"name" in db &&
					db.name === "firebaseLocalStorageDb",
			),
			localStorage: origin.localStorage.filter(
				(entry) => !entry.name.startsWith("firestore_"),
			),
		};
	});
	expect(origins.flatMap((origin) => origin.indexedDB)).toHaveLength(1);
	await writeFile(AUTH_STATE, JSON.stringify({ ...state, origins }));
});
