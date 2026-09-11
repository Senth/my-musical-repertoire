import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { t } from "./support/app";

/**
 * #104. The export is the privacy promise made real, so the spec asserts the
 * download arrives and carries the fixture account's data — not just that the
 * button exists.
 */
test.describe("data export", () => {
	test("privacy page downloads the signed-in account as JSON", async ({
		page,
	}) => {
		await page.goto("/privacy");

		const button = page.getByRole("button", {
			name: t("screen.exportData.button"),
		});
		await expect(button).toBeVisible();

		const downloadPromise = page.waitForEvent("download");
		await button.click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toMatch(
			/^my-musical-repertoire-export-\d{4}-\d{2}-\d{2}\.json$/,
		);

		const data = JSON.parse(readFileSync(await download.path(), "utf8")) as {
			app: string;
			exportedAt: string;
			pieces: unknown[];
			techniques: unknown[];
			sessionPresets: unknown[];
		};

		expect(data.app).toBe("my-musical-repertoire");
		expect(Number.isNaN(Date.parse(data.exportedAt))).toBe(false);
		// The fixture holds four pieces and two techniques; see .ai/config.toml.
		expect(data.pieces).toHaveLength(4);
		expect(data.techniques).toHaveLength(2);
		expect(Array.isArray(data.sessionPresets)).toBe(true);
	});
});
