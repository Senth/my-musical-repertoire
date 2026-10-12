import { expect, test } from "@playwright/test";
import { SEED_IDS, t } from "@/e2e/support/app";
import { contentWidth, inset } from "@/theme/tokens";

for (const path of [
	`/piece/${SEED_IDS.invention}/history`,
	`/technique/${SEED_IDS.scale}/history`,
	"/sight-reading/history",
]) {
	test(`${path} keeps history heading in the centered page band`, async ({
		page,
	}) => {
		await page.goto(path);
		const heading = page.getByRole("heading", {
			name: t("screen.history.title"),
			exact: true,
		});
		await expect(heading).toBeVisible();
		const left = (1280 - contentWidth.page) / 2;
		for (const scheme of ["light", "dark"] as const) {
			await page.emulateMedia({ colorScheme: scheme });
			for (const element of [
				page.getByRole("button", {
					name: t("screen.history.back"),
					exact: true,
				}),
				heading,
			]) {
				const box = await element.boundingBox();
				if (!box) throw new Error("History appbar not measurable");
				expect(box.x, `${scheme} appbar on ${path}`).toBeGreaterThanOrEqual(
					left,
				);
				expect(box.x + box.width).toBeLessThanOrEqual(left + contentWidth.page);
			}
		}
	});
}

test("piece history wraps every section filter without sideways scrolling", async ({
	page,
}) => {
	await page.goto(`/piece/${SEED_IDS.invention}/history`);
	const all = page.getByRole("button", {
		name: t("screen.history.all"),
		exact: true,
	});
	const closing = page.getByRole("button", {
		name: "Closing bars",
		exact: true,
	});
	await expect(closing).toBeVisible();
	for (const scheme of ["light", "dark"] as const) {
		await page.emulateMedia({ colorScheme: scheme });
		const firstBox = await all.boundingBox();
		const lastBox = await closing.boundingBox();
		if (!firstBox || !lastBox)
			throw new Error("History filters not measurable");
		expect(lastBox.y, `${scheme} filter wrapping`).toBeGreaterThan(firstBox.y);
		expect(lastBox.x + lastBox.width).toBeLessThanOrEqual(
			(1280 + contentWidth.page) / 2 - inset.roomy,
		);
	}
	await closing.click();
	await expect(closing).toHaveAttribute("aria-pressed", "true");
});
