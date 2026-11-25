import { t } from "@/e2e/support/app";
import { expect, test } from "@/e2e/support/test";
import { contentWidth } from "@/theme/tokens";

const bandLeft = (1280 - contentWidth.page) / 2;
const bandRight = bandLeft + contentWidth.page;

for (const { path, placeholder, title } of [
	{
		path: "/piece",
		placeholder: t("screen.pieces.searchPlaceholder"),
		title: "Für Elise",
	},
	{
		path: "/technique",
		placeholder: t("screen.techniques.searchPlaceholder"),
		title: "C major scale, two octaves",
	},
]) {
	test(`${path} search and seeded card share the page band`, async ({
		page,
	}) => {
		await page.goto(path);
		const searchInput = page.getByPlaceholder(placeholder, { exact: true });
		const search = searchInput.locator(
			"xpath=ancestor::*[@data-testid='search-bar-container']",
		);
		const titleText = page.getByText(title, { exact: true });
		const card = page.getByTestId("card-container").filter({ has: titleText });
		await expect(searchInput).toBeVisible();
		await expect(search).toBeVisible();
		await expect(titleText).toBeVisible();

		const searchBox = await search.boundingBox();
		const cardBox = await card.boundingBox();
		if (!searchBox || !cardBox)
			throw new Error(`List band not measurable on ${path}`);
		expect(Math.abs(searchBox.x - bandLeft)).toBeLessThanOrEqual(1);
		expect(
			Math.abs(searchBox.x + searchBox.width - bandRight),
		).toBeLessThanOrEqual(1);
		expect(Math.abs(searchBox.x - cardBox.x)).toBeLessThanOrEqual(1);
		expect(
			Math.abs(searchBox.x + searchBox.width - (cardBox.x + cardBox.width)),
		).toBeLessThanOrEqual(1);
	});
}

test("piece filter pills stay in the page band", async ({ page }) => {
	await page.goto("/piece");
	await page
		.getByRole("button", { name: t("common.filter.open"), exact: true })
		.click();
	await page
		.getByRole("button", { name: "Frédéric Chopin", exact: true })
		.click();
	await page
		.getByRole("button", { name: t("common.done"), exact: true })
		.click();

	const titleText = page.getByText("Nocturne in E-flat major", {
		exact: true,
	});
	await expect(titleText).toBeVisible();
	const searchInput = page.getByPlaceholder(
		t("screen.pieces.searchPlaceholder"),
		{ exact: true },
	);
	const search = searchInput.locator(
		"xpath=ancestor::*[@data-testid='search-bar-container']",
	);
	const firstPill = page
		.getByTestId("chip-container")
		.filter({ hasText: "Frédéric Chopin" })
		.first();
	const clearAll = page
		.getByRole("button", {
			name: t("common.filter.clearAll"),
			exact: true,
		})
		.first();
	await expect(searchInput).toBeVisible();
	await expect(search).toBeVisible();
	await expect(firstPill).toBeVisible();
	await expect(clearAll).toBeVisible();

	const searchBox = await search.boundingBox();
	const pillBox = await firstPill.boundingBox();
	const clearAllBox = await clearAll.boundingBox();
	if (!searchBox || !pillBox || !clearAllBox)
		throw new Error("Piece filter band not measurable");
	expect(Math.abs(pillBox.x - searchBox.x)).toBeLessThanOrEqual(1);
	expect(clearAllBox.x + clearAllBox.width).toBeLessThanOrEqual(
		searchBox.x + searchBox.width + 1,
	);
});
