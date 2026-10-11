import { expect, test } from "@playwright/test";
import {
	collectConsoleErrors,
	expectCleanPage,
	SEED_IDS,
	t,
} from "@/e2e/support/app";

test("progress sorts seeded passages, shows hand tempos, expands at target and opens history", async ({
	page,
}) => {
	const consoleErrors = collectConsoleErrors(page);
	await page.goto("/overview");
	await page
		.getByRole("tab", { name: new RegExp(`${t("screen.progress.title")}$`) })
		.click();
	await expect(page).toHaveURL("/progress");
	const rows = page
		.getByRole("link")
		.filter({ has: page.getByTestId("progress-bar-HT") });
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toHaveAccessibleName(/^Middle entries\./);
	await expect(rows.nth(1)).toHaveAccessibleName(/^Exposition\./);
	const exposition = rows.nth(1);
	for (const [hands, bpm] of [
		["LH", 80],
		["RH", 84],
		["HT", 72],
	] as const)
		await expect
			.poll(() =>
				exposition
					.getByTestId(`progress-fill-${hands}-fill`)
					.evaluate(
						(bar) => new DOMMatrixReadOnly(getComputedStyle(bar).transform).a,
					),
			)
			.toBeCloseTo((bpm - 20) / (96 - 20), 3);
	for (const [hands, bpm] of [
		["LH", "80"],
		["RH", "84"],
		["HT", "72"],
	]) {
		await expect(
			exposition
				.getByTestId(`progress-bar-${hands}`)
				.getByText(bpm, { exact: true }),
		).toBeVisible();
	}
	const atTarget = page.getByRole("button", {
		name: "At target in every hand: 1 passage",
		exact: true,
	});
	await expect(atTarget).toHaveAttribute("aria-expanded", "false");
	const scale = page.getByRole("link", {
		name: /^C major scale, two octaves\./,
	});
	await expect(scale).toHaveCount(0);
	await atTarget.click();
	await expect(atTarget).toHaveAttribute("aria-expanded", "true");
	await expect(scale).toBeVisible();
	for (const [hands, bpm] of [
		["LH", "88"],
		["RH", "92"],
	]) {
		await expect(
			scale
				.getByTestId(`progress-bar-${hands}`)
				.getByText(bpm, { exact: true }),
		).toBeVisible();
	}
	await expect(scale.getByTestId("progress-bar-HT")).toHaveCount(0);
	await expectCleanPage(page);
	await scale.click();
	await expect(page).toHaveURL(`/technique/${SEED_IDS.scale}/history`);
	await expect(
		page.getByRole("heading", { name: t("screen.history.title"), exact: true }),
	).toBeVisible();
	await page.goto("/progress");
	await page.getByRole("link", { name: /^Exposition\./ }).click();
	await expect(page).toHaveURL(
		`/piece/${SEED_IDS.invention}/history?sectionId=${SEED_IDS.exposition}`,
	);
	await expect(
		page.getByRole("button", { name: "Exposition", exact: true }),
	).toHaveAttribute("aria-pressed", "true");
	await expect(
		page.getByRole("button", { name: t("screen.history.all"), exact: true }),
	).toHaveAttribute("aria-pressed", "false");
	await expectCleanPage(page);
	expect(consoleErrors).toEqual([]);
});
