import { expect, test } from "@playwright/test";
import { SEED_IDS, t } from "./support/app";

test("section row keeps bars beside name and opens practice or edit", async ({
	page,
}) => {
	await page.goto(`/piece/${SEED_IDS.invention}`);
	const row = page.getByRole("button", { name: "Middle entries", exact: true });
	const name = row.getByText("Middle entries");
	const bars = row.getByText("Bars 7–14");
	await expect(row).toBeVisible();
	await expect(bars).toBeVisible();
	const nameBox = await name.boundingBox();
	const barsBox = await bars.boundingBox();
	if (!nameBox || !barsBox) throw new Error("Section row text not measurable");
	expect(Math.abs(nameBox.y - barsBox.y)).toBeLessThan(8);
	expect(nameBox.x + nameBox.width).toBeLessThan(barsBox.x);
	await page
		.getByRole("button", { name: "Practice section Middle entries" })
		.click();
	await expect(page).toHaveURL(/sectionId=seed-invention-middle/);
	await page.goto(`/piece/${SEED_IDS.invention}`);
	await page
		.getByRole("button", { name: "Middle entries", exact: true })
		.click();
	await expect(
		page.getByText(t("screen.pieceSections.editSection")),
	).toBeVisible();
});

test("whole-piece practice flags only when asked and keeps run-through checkboxes", async ({
	page,
}) => {
	await page.goto(`/piece/${SEED_IDS.invention}/practice`);
	await expect(page.getByText("Bars 7–14")).toBeVisible();
	await expect(page.getByText("— / 96 BPM")).toHaveCount(0);
	await expect(
		page.getByRole("checkbox", { name: /Flag section/ }),
	).toHaveCount(0);
	await page.getByRole("button", { name: "Some" }).first().click();
	const flag = page.getByRole("checkbox", {
		name: "Flag section Middle entries as problematic",
	});
	await expect(flag).not.toBeChecked();
	await flag.click();
	await expect(flag).toBeChecked();
	await flag.click();
	await expect(flag).not.toBeChecked();
	await expect(
		page.getByRole("button", { name: "Practice section Middle entries" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: t("screen.pieceSections.addSection") }),
	).toBeVisible();
	await page.goto(`/piece/${SEED_IDS.furElise}/practice`);
	await expect(
		page.getByRole("checkbox", {
			name: "Flag section Main theme as problematic",
		}),
	).toBeVisible();
	await expect(
		page.getByText(t("screen.practice.sectionsPanel.headerRunThrough")),
	).toBeVisible();
});
