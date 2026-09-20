import { expect, test as setup } from "@playwright/test";
import { SPAN_AUTH_STATE } from "@/playwright.config";
import { t } from "./support/app";

/**
 * A fresh throwaway account per run, not `SEED_USER` and not
 * `.emulator-seed`: the fixture this spec needs is a `learning` piece with no
 * target tempo and three never-practised `stabilizing` sections, which
 * `.emulator-seed` does not carry and which a dated fixture cannot express
 * without #202. Registering fresh every run needs no cleanup — the account is
 * never revisited.
 */
const email = `span-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
const password = "practice123";

setup("register an isolated account", async ({ page, context }) => {
	await page.goto("/");
	await page
		.getByRole("button", {
			name: t("screen.login.switchToRegister"),
			exact: true,
		})
		.click();
	await page
		.getByRole("textbox", { name: t("screen.login.emailLabel"), exact: true })
		.fill(email);
	const secrets = page.locator('input[type="password"]');
	await secrets.nth(0).fill(password);
	await secrets.nth(1).fill(password);
	await page
		.getByRole("button", { name: t("screen.login.register"), exact: true })
		.click();
	await expect(
		page.getByText(t("screen.overview.practiceToday"), { exact: true }),
	).toBeVisible({ timeout: 30_000 });
	await context.storageState({ path: SPAN_AUTH_STATE, indexedDB: true });
});
