import { expect, type Page } from "@playwright/test";

export async function waitForFonts(page: Page): Promise<void> {
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	await expect
		.poll(() => page.evaluate(() => document.fonts.status))
		.toBe("loaded");
}
