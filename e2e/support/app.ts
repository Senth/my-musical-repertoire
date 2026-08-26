import { expect, type Page } from "@playwright/test";
import en from "@/i18n/locales/en-US.json";

/**
 * The English copy, by key. Specs address fields and buttons by the string a
 * person sees, and that string lives in exactly one place — reading it here
 * means a copy change breaks the suite loudly instead of silently selecting
 * the wrong element.
 */
export function t(key: string): string {
	const value = key
		.split(".")
		.reduce<unknown>(
			(node, part) =>
				node && typeof node === "object"
					? (node as Record<string, unknown>)[part]
					: undefined,
			en,
		);
	if (typeof value !== "string") {
		throw new Error(`no en-US string for "${key}"`);
	}
	return value;
}

/**
 * The account baked into `.emulator-seed/`. The fixture is what makes a run
 * deterministic, so these two values and the seeded repertoire are a contract:
 * regenerating the fixture means re-checking every readiness marker below.
 */
export const SEED_USER = {
	email: "pianist@example.com",
	password: "practice123",
} as const;

/**
 * Paper renders its floating label as a sibling `Text`, not as the input's
 * accessible name, so the fields are found by role and type instead. A
 * `secureTextEntry` input is `type="password"`, which is not `role=textbox` —
 * that asymmetry is what keeps these two locators unambiguous.
 */
export async function signIn(page: Page): Promise<void> {
	await page.goto("/");
	await page
		.getByRole("textbox", { name: t("screen.login.emailLabel"), exact: true })
		.fill(SEED_USER.email);
	await page.locator('input[type="password"]').fill(SEED_USER.password);
	await page
		.getByRole("button", { name: t("screen.login.email"), exact: true })
		.click();
	await expectSignedIn(page);
}

/** Resolves once the app has rendered a signed-in screen, not just navigated. */
export async function expectSignedIn(page: Page): Promise<void> {
	await expect(
		page.getByText(t("screen.overview.practiceToday"), { exact: true }),
	).toBeVisible({ timeout: 30_000 });
}

/**
 * Every route worth sweeping, with the marker that proves it finished
 * rendering. Detail routes use ids from the fixture, so a regenerated fixture
 * must update them here.
 */
export const ROUTES: { path: string; ready: string }[] = [
	{ path: "/overview", ready: t("screen.overview.practiceToday") },
	{ path: "/piece", ready: t("screen.pieces.title") },
	{ path: "/technique", ready: t("screen.techniques.title") },
	{ path: "/piece/add", ready: t("screen.addPiece.title") },
	{ path: "/technique/add", ready: t("screen.addTechnique.title") },
	{ path: "/privacy", ready: t("screen.privacy.title") },
	{ path: "/terms", ready: t("screen.terms.title") },
];

/**
 * Collects console errors and page exceptions for the lifetime of a test.
 * Expo's dev server emits a few of its own; the allow list is deliberately a
 * closed set, so a new entry is a decision rather than a drift.
 */
const CONSOLE_ALLOW = [
	/Download the React DevTools/,
	// react-native-web 0.21 deprecations raised from inside Paper and
	// Reanimated. Ours to report upstream, not ours to fix, and they only
	// appear in a development bundle.
	/props\.pointerEvents is deprecated/,
	/"shadow\*" style props are deprecated/,
	/useNativeDriver` is not supported/,
];

export function collectConsoleErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on("console", (msg) => {
		if (msg.type() !== "error" && msg.type() !== "warning") return;
		const text = msg.text();
		if (CONSOLE_ALLOW.some((re) => re.test(text))) return;
		errors.push(`${msg.type()}: ${text}`);
	});
	page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
	return errors;
}
