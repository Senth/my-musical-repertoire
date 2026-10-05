import { expect, test as setup } from "@playwright/test";
import { t } from "@/e2e/support/app";
import { HISTORY_AUTH_STATE } from "@/playwright.config";

const email = `practice-history-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
const password = "practice123";

setup("register an isolated history account", async ({ page, context }) => {
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
	await context.storageState({ path: HISTORY_AUTH_STATE, indexedDB: true });
});
