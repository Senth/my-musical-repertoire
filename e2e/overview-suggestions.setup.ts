import { expect, test as setup } from "@playwright/test";
import { OVERVIEW_AUTH_STATE } from "../playwright.config";
import { t } from "./support/app";

/**
 * A fresh account per run, not `SEED_USER` — `overview-suggestions.spec.ts`
 * practises pieces and leaves new ones behind, and running that against the
 * shared fixture account would make a second `yarn e2e` behave differently
 * without a re-seed in between. A unique email every run needs no cleanup:
 * the account is simply never revisited.
 */
const email = `overview-suggestions-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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
	await context.storageState({ path: OVERVIEW_AUTH_STATE, indexedDB: true });
});
