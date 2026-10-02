import { expect, test } from "@playwright/test";
import { collectConsoleErrors, SEED_IDS, t } from "./support/app";

const INVENTION_SECTIONS = [
	{ name: "Exposition", bars: "Bars 1–6" },
	{ name: "Middle entries", bars: "Bars 7–14" },
];

test("section row keeps bars beside name and opens practice or edit", async ({
	page,
}) => {
	const consoleErrors = collectConsoleErrors(page);
	await page.goto(`/piece/${SEED_IDS.invention}`);
	await expect(page.locator("button button")).toHaveCount(0);
	const row = page.getByRole("button", { name: "Middle entries", exact: true });
	const body = row.locator("xpath=..");
	await expect(row.locator('button, [role="button"]')).toHaveCount(0);
	const name = body.getByText("Middle entries");
	const bars = body.getByText("Bars 7–14");
	await expect(row).toBeVisible();
	await expect(bars).toBeVisible();
	for (const section of INVENTION_SECTIONS) {
		await expect(
			page.getByRole("button", { name: section.name, exact: true }),
		).toBeVisible();
		await expect(page.getByText(section.bars, { exact: true })).toBeVisible();
	}
	const nameBox = await name.boundingBox();
	const barsBox = await bars.boundingBox();
	if (!nameBox || !barsBox) throw new Error("Section row text not measurable");
	expect(Math.abs(nameBox.y - barsBox.y)).toBeLessThan(8);
	expect(nameBox.x + nameBox.width).toBeLessThan(barsBox.x);
	const chipBox = await body
		.getByRole("button", { name: t("section.state.learning"), exact: true })
		.boundingBox();
	if (!chipBox) throw new Error("Section state control not measurable");
	expect(chipBox.height).toBeGreaterThanOrEqual(48);
	expect(chipBox.width).toBeGreaterThanOrEqual(48);
	await page.touchscreen.tap(
		chipBox.x + chipBox.width / 2,
		chipBox.y + chipBox.height - 2,
	);
	await expect(page.getByText(t("section.state.maintenance"))).toBeVisible();
	expect(consoleErrors).toEqual([]);
	await expect(
		page.getByText(t("screen.pieceSections.editSection")),
	).toHaveCount(0);
	await page.keyboard.press("Escape");
	await page
		.getByRole("button", { name: "Practice section Middle entries" })
		.click();
	await expect(page).toHaveURL(/sectionId=seed-invention-middle/);
	await page.goto(`/piece/${SEED_IDS.invention}`);
	const edit = page.getByRole("button", {
		name: "Middle entries",
		exact: true,
	});
	const editBox = await edit.boundingBox();
	const barBox = await page
		.getByText("Bars 7–14", { exact: true })
		.boundingBox();
	if (!editBox || !barBox) throw new Error("Section row body not measurable");
	await edit.click({
		position: {
			x: barBox.x + barBox.width / 2 - editBox.x,
			y: barBox.y + barBox.height / 2 - editBox.y,
		},
	});
	await expect(
		page.getByText(t("screen.pieceSections.editSection")),
	).toBeVisible();
});

for (const width of [412, 1280]) {
	test(`section indicator and native-column chip edges respond independently at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		const consoleErrors = collectConsoleErrors(page);
		await page.goto(`/piece/${SEED_IDS.invention}/practice`);
		await page.getByRole("button", { name: "Some" }).first().click();
		const flag = page.getByRole("checkbox", {
			name: "Flag section Middle entries as problematic",
		});
		const body = flag.locator("xpath=..");
		const indicator = body.getByRole("checkbox", {
			name: "",
			exact: true,
			disabled: true,
		});
		await indicator.scrollIntoViewIfNeeded();
		const indicatorBox = await indicator.boundingBox();
		if (!indicatorBox) throw new Error("Section flag indicator not measurable");
		const tap = async (x: number, y: number) => {
			if (width === 412) await page.touchscreen.tap(x, y);
			else await page.mouse.click(x, y);
		};
		await expect(flag).not.toBeChecked();
		await tap(
			indicatorBox.x + indicatorBox.width / 2,
			indicatorBox.y + indicatorBox.height / 2,
		);
		await expect(flag).toBeChecked();
		await tap(
			indicatorBox.x + indicatorBox.width / 2,
			indicatorBox.y + indicatorBox.height / 2,
		);
		await expect(flag).not.toBeChecked();
		const chip = body.getByRole("button", {
			name: t("section.state.learning"),
			exact: true,
		});
		await body.getByTestId("chip-container").evaluate((container) => {
			container.style.flexDirection = "column";
		});
		await chip.scrollIntoViewIfNeeded();
		const chipBox = await chip.boundingBox();
		const surfaceBox = await body.getByTestId("chip-container").boundingBox();
		if (!chipBox || !surfaceBox)
			throw new Error("Section state control not measurable");
		expect(chipBox.height).toBeGreaterThanOrEqual(48);
		expect(chipBox.width).toBeGreaterThanOrEqual(48);
		await tap(
			surfaceBox.x + surfaceBox.width / 2,
			surfaceBox.y + surfaceBox.height - 2,
		);
		await expect(page.getByText(t("section.state.maintenance"))).toBeVisible();
		await expect(flag).not.toBeChecked();
		await expect(
			page.getByText(t("screen.pieceSections.editSection")),
		).toHaveCount(0);
		await expect(page).toHaveURL(`/piece/${SEED_IDS.invention}/practice`);
		expect(consoleErrors).toEqual([]);
	});
}

test("whole-piece practice flags only when asked and keeps run-through checkboxes", async ({
	page,
}) => {
	const consoleErrors = collectConsoleErrors(page);
	await page.goto(`/piece/${SEED_IDS.invention}/practice`);
	for (const section of INVENTION_SECTIONS) {
		const playLabel = t("section.a11yPractice").replace(
			"{{label}}",
			section.name,
		);
		const playButton = page.getByRole("button", {
			name: playLabel,
			exact: true,
		});
		await expect(playButton).toBeVisible();
		const row = playButton.locator("xpath=../..");
		await expect(row.getByText(section.name, { exact: true })).toBeVisible();
		await expect(row.getByText(section.bars, { exact: true })).toBeVisible();
		await expect(row).not.toContainText(/\/ 96 BPM/);
	}
	await expect(
		page.getByRole("checkbox", { name: /Flag section/ }),
	).toHaveCount(0);
	await page.getByRole("button", { name: "Some" }).first().click();
	const flag = page.getByRole("checkbox", {
		name: "Flag section Middle entries as problematic",
	});
	await expect(flag).not.toBeChecked();
	await flag
		.locator("xpath=../..")
		.getByText(t("section.state.learning"), { exact: true })
		.click();
	await expect(page.getByText(t("section.state.maintenance"))).toBeVisible();
	await expect(flag).not.toBeChecked();
	expect(consoleErrors).toEqual([]);
	await page.keyboard.press("Escape");
	await flag.click();
	await expect(flag).toBeChecked();
	const flagBox = await flag.boundingBox();
	const barsBox = await flag
		.locator("xpath=..")
		.getByText("Bars 7–14")
		.boundingBox();
	if (!flagBox || !barsBox) throw new Error("Section flag body not measurable");
	await flag.click({
		position: {
			x: barsBox.x + barsBox.width / 2 - flagBox.x,
			y: barsBox.y + barsBox.height / 2 - flagBox.y,
		},
	});
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
